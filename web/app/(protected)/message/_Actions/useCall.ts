"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, type LocalAudioTrack, ParticipantEvent, type RemoteParticipant, Room, RoomEvent, Track } from "livekit-client";

import { addToast } from "@heroui/toast";
import { onAudioSettingsChanged, readInputDevice, readInputVolume, readOutputDevice, readOutputVolume } from "@/lib/audioSettings";
import { MicGainProcessor } from "@/lib/micGainProcessor";
import { useSound } from "react-sounds";

import { readAudioProcessingPrefs } from "@/lib/mediaPrefs";
import { readProblemDetail } from "@/lib/problemDetails";
import { useRealtime } from "@/lib/hooks/useRealtime";
import type { CallParticipant, ScreenShare } from "@/types/call";
import { installStartBitrateOverride } from "./utils/startBitrateOverride";
import { clearMediaSession, livekitUrlForThisBrowser, setMediaSessionActive } from "./utils/callEnvironment";
import { useScreenShare } from "./useScreenShare";

/** RMS loudness (0..1) over which someone counts as speaking. Low on purpose, so the ring reacts to any real input. */
const SPEAKING_RMS_THRESHOLD = 0.015;

/** Keep the ring lit this long after the last loud frame, so it doesn't strobe between syllables. */
const SPEAKING_HOLD_MS = 250;

/** Participant attribute each client sets while deafened. */
const DEAFENED_ATTRIBUTE = "deafened";

interface UseCallState {
  connected: boolean;
  connecting: boolean;
  /** LiveKit is re-establishing a dropped connection: still `connected`, not live yet. */
  reconnecting: boolean;
  participants: CallParticipant[];
  muted: boolean;
  /** True while deafened: all remote audio is silenced and the mic is muted. */
  deafened: boolean;
  screenSharing: boolean;
  /** Every screen currently being shared, local and remote — one per sharer. */
  screenShares: ScreenShare[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  /** Leave unless a join happens first: for effect cleanups. Use `leave` to hang up. */
  scheduleLeave: () => void;
  toggleMute: () => Promise<void>;
  /** Silence everything we hear and mute our mic; press again to restore both. */
  toggleDeafen: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  /** Reconnect after the call moved region: fresh token, silent for others, a muted mic stays muted. */
  rejoinForServerChange: (regionName?: string) => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  toggleParticipantMute: (identity: string) => void;
  muteParticipantForEveryone: (identity: string) => Promise<boolean>;
  setScreenShareVolume: (identity: string, volume: number) => void;
  /** Play only this share's audio; null when the expanded view closes. */
  watchScreenShareAudio: (identity: string | null) => void;
}

/** One LiveKit room per call; the room name is the conversation id, so DMs and group calls are the same. */
export function useCall(conversationId: string | null): UseCallState {
  const { send, subscribe } = useRealtime();
  const roomRef = useRef<Room | null>(null);

  // Join/leave sounds are held in refs: the handlers registered in join() would capture stale functions.
  const { play: playJoin } = useSound("ui/pop_open");
  const { play: playLeave } = useSound("ui/pop_close");
  const playJoinRef = useRef(playJoin);
  const playLeaveRef = useRef(playLeave);

  useEffect(() => {
    playJoinRef.current = playJoin;
  }, [playJoin]);
  useEffect(() => {
    playLeaveRef.current = playLeave;
  }, [playLeave]);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);
  const participantVolumesRef = useRef(new Map<string, number>());
  const participantAudibleVolumesRef = useRef(new Map<string, number>());

  // Deafen: silences everything we hear (and mutes the mic). It works by forcing
  // every remote gain to 0, and every place that sets a gain goes through
  const [deafened, setDeafened] = useState(false);
  const deafenedRef = useRef(false);
  const micMutedBeforeDeafenRef = useRef(false);
  // Set while moving regions: no CALL_ENDED/CALL_STARTED or leave sound, so the call carries on for everyone else.
  const silentReconnectRef = useRef(false);
  // Settings > Speaker volume: a master level on everything we hear, on top of each
  // person's own volume. Only changes our playback, never what others receive.
  const outputMasterRef = useRef(1);
  const gain = (volume: number) =>
    deafenedRef.current ? 0 : volume * outputMasterRef.current;

  useEffect(() => {
    outputMasterRef.current = readOutputVolume() / 100;
  }, []);

  const {
    screenSharing,
    screenShares,
    toggleScreenShare,
    setScreenShareVolume,
    watchScreenShareAudio,
    screenShareVolume,
    watchedScreenShareAudioRef,
    attachScreenShareListeners,
    noteConnected,
    resetScreenShares,
    stopAllScreenShareStatsLogging,
  } = useScreenShare({ roomRef, gain, setError });

  const participantVolume = useCallback((identity: string) => {
    const existing = participantVolumesRef.current.get(identity);

    if (existing != null) return existing;

    const saved = localStorage.getItem(`call-volume:${identity}`);
    const stored = saved == null ? Number.NaN : Number(saved);
    const volume = Number.isFinite(stored)
      ? Math.min(200, Math.max(0, stored))
      : 100;

    participantVolumesRef.current.set(identity, volume);
    if (volume > 0) participantAudibleVolumesRef.current.set(identity, volume);

    return volume;
  }, []);

  const setParticipantVolume = useCallback(
    (identity: string, value: number) => {
      const volume = Math.round(Math.min(200, Math.max(0, value)));

      participantVolumesRef.current.set(identity, volume);
      localStorage.setItem(`call-volume:${identity}`, String(volume));
      if (volume > 0) {
        participantAudibleVolumesRef.current.set(identity, volume);
        localStorage.setItem(
          `call-volume-before-mute:${identity}`,
          String(volume),
        );
      }
      roomRef.current?.remoteParticipants
        .get(identity)
        ?.setVolume(gain(volume / 100), Track.Source.Microphone);
      setParticipants((current) =>
        current.map((participant) =>
          participant.identity === identity
            ? { ...participant, volume }
            : participant,
        ),
      );
    },
    [],
  );

  const toggleParticipantMute = useCallback(
    (identity: string) => {
      const current = participantVolume(identity);

      if (current > 0) {
        participantAudibleVolumesRef.current.set(identity, current);
        localStorage.setItem(
          `call-volume-before-mute:${identity}`,
          String(current),
        );
        setParticipantVolume(identity, 0);

        return;
      }

      const saved = Number(
        localStorage.getItem(`call-volume-before-mute:${identity}`),
      );
      const restored =
        participantAudibleVolumesRef.current.get(identity) ??
        (Number.isFinite(saved) && saved > 0 ? saved : 100);

      setParticipantVolume(identity, restored);
    },
    [participantVolume, setParticipantVolume],
  );

  const muteParticipantForEveryone = useCallback(
    async (identity: string) => {
      if (!conversationId) return false;

      try {
        const response = await fetch(
          `/api/voice/rooms/${encodeURIComponent(conversationId)}/participants/${encodeURIComponent(identity)}/mute`,
          { method: "POST" },
        );

        if (!response.ok) {
          addToast({
            title: await readProblemDetail(
              response,
              "Could not mute this participant for everyone.",
            ),
            color: "danger",
          });

          return false;
        }

        return true;
      } catch {
        addToast({
          title: "Could not mute this participant for everyone.",
          color: "danger",
        });

        return false;
      }
    },
    [conversationId],
  );

  /** Re-applies every remote gain (used when deafen toggles; `gain()` does the muting). */
  const applyOutputVolumes = useCallback(
    (room: Room) => {
      room.remoteParticipants.forEach((participant) => {
        participant.setVolume(
          gain(participantVolume(participant.identity) / 100),
          Track.Source.Microphone,
        );
        participant.setVolume(
          gain(
            watchedScreenShareAudioRef.current === participant.identity
              ? screenShareVolume(participant.identity) / 100
              : 0,
          ),
          Track.Source.ScreenShareAudio,
        );
      });
    },
    // `gain` only reads a ref, so it is safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [participantVolume, screenShareVolume],
  );

  // Our own mic is analysed locally: LiveKit's isSpeaking is server-side, coarse and ignores quiet input.
  // Remote tracks use LiveKit's isSpeaking, since routing them through Web Audio can break their playback.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef(
    new Map<
      string,
      { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }
    >(),
  );

  /**
 * Guards against two joins at once (StrictMode double-invokes effects, and `roomRef` is only set after `connect()`).
 * The token lets `leave()` disown a join still in flight.
 */
  const joiningRef = useRef(false);
  const joinTokenRef = useRef(0);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addAnalyser = useCallback(
    (identity: string, track: MediaStreamTrack) => {
      try {
        const ctx = audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());

        if (ctx.state === "suspended") ctx.resume().catch(() => {});

        analysersRef.current.get(identity)?.source.disconnect();

        const source = ctx.createMediaStreamSource(new MediaStream([track]));
        const analyser = ctx.createAnalyser();

        // 256 matches the sample buffer in the rAF loop below; small window so
        // the reading tracks the signal closely rather than averaging it away.
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        // Analyser only -- deliberately NOT connected to ctx.destination, which
        // would play remote audio a second time on top of the <audio> elements.
        source.connect(analyser);

        analysersRef.current.set(identity, { analyser, source });
      } catch {
        // Web Audio unavailable -- the ring just won't light; the call is fine.
      }
    },
    [],
  );

  const refreshParticipants = useCallback(
    (room: Room) => {
      const local = room.localParticipant;

      setParticipants([
        {
          identity: local.identity,
          isLocal: true,
          isSpeaking: false, // ours is filled in from the analyser on the way out
          isMuted: !local.isMicrophoneEnabled,
          isDeafened: deafenedRef.current,
          volume: 100,
        },
        ...Array.from(room.remoteParticipants.values()).map((p) => ({
          identity: p.identity,
          isLocal: false,
          isSpeaking: p.isSpeaking,
          isMuted: !p.isMicrophoneEnabled,
          isDeafened: p.attributes[DEAFENED_ATTRIBUTE] === "true",
          volume: participantVolume(p.identity),
        })),
      ]);
    },
    [participantVolume],
  );

  // ── Settings > audio applied to the call ───────────────────────────────────
  const micGainRef = useRef<MicGainProcessor | null>(null);
  const appliedDevicesRef = useRef<{ input?: string; output?: string }>({});

  const attachMicGain = useCallback(async (track: LocalAudioTrack) => {
    const volume = readInputVolume() / 100;

    // At 100% (the default) the mic goes out untouched, with no processing in the way.
    if (volume === 1 && !micGainRef.current) return;

    try {
      const ctx =
        audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());

      if (ctx.state === "suspended") await ctx.resume().catch(() => {});

      track.setAudioContext(ctx);

      const processor = new MicGainProcessor(volume);

      await track.setProcessor(processor);
      micGainRef.current = processor;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Could not apply the microphone volume", error);
    }
  }, []);

  const applyAudioSettings = useCallback(
    (room: Room, initial = false) => {
      outputMasterRef.current = readOutputVolume() / 100;
      applyOutputVolumes(room);

      const output = readOutputDevice();

      if (output !== (appliedDevicesRef.current.output ?? "default")) {
        appliedDevicesRef.current.output = output;
        void room.switchActiveDevice("audiooutput", output).catch(() => {});
      }

      // On join the mic is published with the saved device and volume already.
      if (initial) return;

      const input = readInputDevice();

      if (input !== (appliedDevicesRef.current.input ?? "default")) {
        appliedDevicesRef.current.input = input;
        void room.switchActiveDevice("audioinput", input).catch(() => {});
      }

      const volume = readInputVolume() / 100;

      if (micGainRef.current) {
        micGainRef.current.setGain(volume);
      } else if (volume !== 1) {
        const track = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track as LocalAudioTrack | undefined;

        if (track) void attachMicGain(track);
      }
    },
    [applyOutputVolumes, attachMicGain],
  );

  useEffect(
    () =>
      onAudioSettingsChanged(() => {
        const room = roomRef.current;

        if (room) applyAudioSettings(room);
        else outputMasterRef.current = readOutputVolume() / 100;
      }),
    [applyAudioSettings],
  );

  // Tell the room whether we're deafened (an empty value clears the attribute).
  // Needs the token's canUpdateOwnMetadata grant; without it others just don't see it.
  useEffect(() => {
    const room = roomRef.current;

    if (!room || !connected) return;

    room.localParticipant
      .setAttributes({ [DEAFENED_ATTRIBUTE]: deafened ? "true" : "" })
      .catch(() => {});
    refreshParticipants(room);
  }, [deafened, connected, refreshParticipants]);

  const teardownAudio = useCallback(() => {
    analysersRef.current.forEach(({ source }) => {
      try {
        source.disconnect();
      } catch {
        // already torn down
      }
    });
    analysersRef.current.clear();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    micGainRef.current = null;
    appliedDevicesRef.current = {};
  }, []);

  /** Turn the mic on, retrying briefly: publishing races `connect()` and fails transiently while the transport settles. Returns false only if it won't start. */
  const publishMic = useCallback(async (room: Room) => {
    const prefs = readAudioProcessingPrefs();
    const savedDevice = readInputDevice();
    const options = {
      noiseSuppression: prefs.noiseSuppression,
      echoCancellation: prefs.echoCancellation,
      autoGainControl: true,
      // `ideal`, so a device that's gone falls back to the default instead of failing.
      ...(savedDevice !== "default" ? { deviceId: { ideal: savedDevice } } : {}),
    };

    appliedDevicesRef.current.input = savedDevice;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      // Bail out if the call ended while we were waiting to retry.
      if (room.state === ConnectionState.Disconnected) return false;

      try {
        await room.localParticipant.setMicrophoneEnabled(true, options);

        return true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`Mic publish attempt ${attempt + 1} failed`, err);
      }
    }

    return false;
  }, []);

  const leave = useCallback(() => {
    // Invalidate any join still awaiting connect() -- see joinTokenRef.
    joinTokenRef.current += 1;
    // ...and release the in-flight claim so an immediate rejoin (StrictMode remount) isn't blocked by the cancelled one.
    joiningRef.current = false;

    const room = roomRef.current;

    roomRef.current = null;

    if (room) {
      room.disconnect();
      // Only announce leaving a call we actually joined; a cancelled join
      // never told anyone it had started.
      if (conversationId && !silentReconnectRef.current) {
        send({ type: "CALL_ENDED", conversationId });
      }
      if (!silentReconnectRef.current) playLeaveRef.current().catch(() => {});
    }

    teardownAudio();
    resetScreenShares();
    clearMediaSession();
    setConnected(false);
    setReconnecting(false);
    setParticipants([]);
    setSpeakingIds([]);
    setMuted(false);
    deafenedRef.current = false;
    setDeafened(false);
  }, [conversationId, send, teardownAudio, resetScreenShares]);

  /** Deferred `leave` for effect cleanups, so StrictMode's throwaway unmount can be cancelled by the remount (see join). */
  const scheduleLeave = useCallback(() => {
    if (teardownTimerRef.current) clearTimeout(teardownTimerRef.current);

    teardownTimerRef.current = setTimeout(() => {
      teardownTimerRef.current = null;
      leave();
    }, 0);
  }, [leave]);

  // Sample every analyser once a frame and publish the set of people currently
  // speaking. One loop for the whole room, running only while connected.
  useEffect(() => {
    if (!connected) return;

    let frame = 0;
    const buffer = new Uint8Array(256);
    const lastLoudAt = new Map<string, number>();

    const tick = () => {
      const now = performance.now();

      analysersRef.current.forEach(({ analyser }, identity) => {
        analyser.getByteTimeDomainData(buffer);

        // Byte time-domain data is centred on 128; RMS of the deviation is
        // the signal's loudness.
        let sumSquares = 0;

        for (let i = 0; i < buffer.length; i++) {
          const deviation = (buffer[i] - 128) / 128;

          sumSquares += deviation * deviation;
        }

        if (Math.sqrt(sumSquares / buffer.length) > SPEAKING_RMS_THRESHOLD) {
          lastLoudAt.set(identity, now);
        }
      });

      const speaking: string[] = [];

      lastLoudAt.forEach((at, identity) => {
        if (now - at < SPEAKING_HOLD_MS) speaking.push(identity);
      });

      setSpeakingIds((prev) =>
        prev.length === speaking.length &&
        speaking.every((id) => prev.includes(id))
          ? prev // same set -- don't re-render every frame
          : speaking,
      );

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [connected]);

  // Leave on unmount (navigating away, closing the panel) so a connected
  // room never keeps publishing mic/screen in the background.
  useEffect(() => {
    return () => {
      if (teardownTimerRef.current) clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
      teardownAudio();
      stopAllScreenShareStatsLogging();
      clearMediaSession();
    };
  }, [teardownAudio, stopAllScreenShareStatsLogging]);

  const join = useCallback(async () => {
    // A pending deferred teardown means a StrictMode remount or fast rejoin: cancel it and keep the connection.
    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    if (!conversationId || roomRef.current || joiningRef.current) return;

    // Claimed before the first await so StrictMode's remount finds it set and returns: one token fetch, one connect().
    joiningRef.current = true;

    const joinToken = ++joinTokenRef.current;

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch(`/api/voice/rooms/${conversationId}/token`, {
        method: "POST",
      });

      if (!res.ok) {
        setError(await readProblemDetail(res, "Could not join the call."));

        return;
      }

      const { serverUrl, token } = (await res.json()) as {
        serverUrl: string;
        token: string;
      };

      // Patches RTCPeerConnection once per page so a forced screen-share start bitrate can be applied.
      installStartBitrateOverride();

      const room = new Room({ webAudioMix: true });

      // Remote speaking comes from LiveKit; isSpeakingChanged is per-participant
      // and more reliable than the room-level ActiveSpeakersChanged aggregate.
      const wireRemote = (p: RemoteParticipant) => {
        p.setVolume(
          gain(participantVolume(p.identity) / 100),
          Track.Source.Microphone,
        );
        p.setVolume(
          gain(watchedScreenShareAudioRef.current === p.identity
            ? screenShareVolume(p.identity) / 100
            : 0),
          Track.Source.ScreenShareAudio,
        );
        p.on(ParticipantEvent.IsSpeakingChanged, () =>
          refreshParticipants(room),
        );
      };

      room.on(RoomEvent.ParticipantConnected, (p) => {
        wireRemote(p);
        refreshParticipants(room);
        playJoinRef.current().catch(() => {});
      });
      // Someone (un)deafened: their attribute changed.
      room.on(RoomEvent.ParticipantAttributesChanged, (changed) => {
        if (DEAFENED_ATTRIBUTE in changed) refreshParticipants(room);
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        refreshParticipants(room);
        playLeaveRef.current().catch(() => {});
      });
      const refreshMuteState = () => {
        refreshParticipants(room);
        setMuted(!room.localParticipant.isMicrophoneEnabled);
      };

      room.on(RoomEvent.TrackMuted, refreshMuteState);
      room.on(RoomEvent.TrackUnmuted, refreshMuteState);

      // Notified on every (re)connect, separate from the rest of join() so a later failure (e.g. mic permission) can't swallow it.
      room.on(RoomEvent.Connected, () => {
        applyAudioSettings(room, true);
        noteConnected();
        if (conversationId && !silentReconnectRef.current) {
          send({ type: "CALL_STARTED", conversationId });
        }
      });

      // Microphones play through hidden audio elements. Screen-share tracks are
      // handled by useScreenShare's listeners.
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (
          publication.source !== Track.Source.ScreenShareAudio &&
          track.kind === Track.Kind.Audio
        ) {
          participant.setVolume(
            gain(participantVolume(participant.identity) / 100),
            Track.Source.Microphone,
          );
          const el = track.attach();

          el.autoplay = true;
          el.dataset.livekitTrack = track.sid ?? "";
          el.dataset.livekitParticipant = participant.identity;
          el.dataset.livekitSource = publication.source;
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        // Unmuting republishes the mic as a NEW capture track, so the old
        // analyser would be reading a dead one -- re-point it at the new track.
        if (
          publication.source === Track.Source.Microphone &&
          publication.track
        ) {
          addAnalyser(participant.identity, publication.track.mediaStreamTrack);
          void attachMicGain(publication.track as LocalAudioTrack);
        }
      });

      attachScreenShareListeners(room);

      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setConnected(false);
        setReconnecting(false);
        setParticipants([]);
        clearMediaSession();
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected) setConnected(false);
      });

      // LiveKit's own reconnect (e.g. a throttled background tab missed its pings): show "reconnecting" instead of a dead call.
      room.on(RoomEvent.Reconnecting, () => {
        setReconnecting(true);
      });
      room.on(RoomEvent.Reconnected, () => {
        setReconnecting(false);
        refreshParticipants(room);
      });

      // Default is 15s -- kept generous because ICE negotiation through
      // Docker's published ports is slower than on bare metal.
      await room.connect(livekitUrlForThisBrowser(serverUrl), token, {
        peerConnectionTimeout: 30_000,
      });

      // Left (or re-joined) while we were connecting -- this room is orphaned,
      // so drop it rather than leaving a second connection alive.
      if (joinTokenRef.current !== joinToken) {
        room.disconnect();

        return;
      }

      // Commit to being in the call before touching the mic: publishing can fail on its own, and bailing out here would leave the controls dead.
      roomRef.current = room;
      setConnected(true);
      refreshParticipants(room);
      playJoinRef.current().catch(() => {});
      setMediaSessionActive("Voice call");

      // Anyone already in the room when we arrived -- ParticipantConnected only
      // fires for people who join after us.
      room.remoteParticipants.forEach(wireRemote);

      const published = await publishMic(room);

      if (published) {
        // Our own mic, straight off the local capture track -- this is the one
        // that has to react to every input, and it never leaves the browser.
        const micTrack = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track;

        if (micTrack) {
          addAnalyser(
            room.localParticipant.identity,
            micTrack.mediaStreamTrack,
          );
        }
        setMuted(false);
      } else {
        // In the call, just not publishing. Surfaced as muted so the mic button
        // is the obvious way to retry.
        setMuted(true);
        setError(
          "You're connected, but your microphone didn't start. Use the mic button to retry.",
        );
      }

      refreshParticipants(room);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to join call", err);
      setError(
        err instanceof Error
          ? `Could not join the call: ${err.message}`
          : "Could not join the call.",
      );
    } finally {
      // A cancelled join finishing late must not clear the flag or spinner of the join that replaced it.
      if (joinTokenRef.current === joinToken) {
        joiningRef.current = false;
        setConnecting(false);
      }
    }
  }, [
    conversationId,
    refreshParticipants,
    send,
    publishMic,
    addAnalyser,
    applyAudioSettings,
    attachMicGain,
    attachScreenShareListeners,
    noteConnected,
    participantVolume,
    screenShareVolume,
  ]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    if (muted) {
      // Unmuting while deafened also undeafens (you can't talk without hearing).
      if (deafenedRef.current) {
        deafenedRef.current = false;
        setDeafened(false);
        applyOutputVolumes(room);
      }

      // Also the retry path when the mic failed to start on join, so it goes
      // through publishMic rather than a bare one-shot enable.
      if (await publishMic(room)) {
        setMuted(false);
        setError(null);

        const micTrack = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track;

        if (micTrack) {
          addAnalyser(
            room.localParticipant.identity,
            micTrack.mediaStreamTrack,
          );
        }
      } else {
        setError("Your microphone still didn't start.");
      }

      return;
    }

    await room.localParticipant.setMicrophoneEnabled(false);
    setMuted(true);
  }, [muted, publishMic, addAnalyser, applyOutputVolumes]);

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    if (!deafenedRef.current) {
      micMutedBeforeDeafenRef.current = muted;
      deafenedRef.current = true;
      setDeafened(true);
      applyOutputVolumes(room);
      if (!muted) await toggleMute();

      return;
    }

    // Undeafen: hear everyone again, and unmute only if the mic was live before.
    deafenedRef.current = false;
    setDeafened(false);
    applyOutputVolumes(room);
    if (!micMutedBeforeDeafenRef.current && muted) await toggleMute();
  }, [muted, toggleMute, applyOutputVolumes]);

  const rejoinForServerChange = useCallback(
    async (regionName?: string) => {
      if (!roomRef.current || silentReconnectRef.current) return;

      const wasMuted = muted;

      silentReconnectRef.current = true;
      try {
        leave();
        await join();

        // join() publishes the mic; keep a muted user muted across the move.
        const room = roomRef.current as Room | null;

        if (wasMuted && room) {
          await room.localParticipant.setMicrophoneEnabled(false);
          setMuted(true);
        }

        addToast({
          title: regionName ? `Call moved to ${regionName}` : "Call server changed",
        });
      } finally {
        silentReconnectRef.current = false;
      }
    },
    [muted, leave, join],
  );


  // Another member moved the call to a new region: everyone reconnects. Read via a ref so the subscription isn't re-created on every render.
  const rejoinForServerChangeRef = useRef(rejoinForServerChange);

  rejoinForServerChangeRef.current = rejoinForServerChange;

  useEffect(
    () =>
      subscribe("CALL_REGION_CHANGED", (event) => {
        if (event.conversationId !== conversationId) return;
        void rejoinForServerChangeRef.current(event.regionName);
      }),
    [subscribe, conversationId],
  );

  return {
    connected,
    connecting,
    reconnecting,
    // Ours is analyser-driven (instant, catches any input); everyone else's
    // comes from LiveKit, already on the roster.
    participants: participants.map((p) => ({
      ...p,
      isSpeaking:
        !p.isMuted &&
        (p.isLocal ? speakingIds.includes(p.identity) : p.isSpeaking),
    })),
    muted,
    deafened,
    screenSharing,
    screenShares,
    error,
    join,
    leave,
    scheduleLeave,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
    rejoinForServerChange,
    setParticipantVolume,
    toggleParticipantMute,
    muteParticipantForEveryone,
    setScreenShareVolume,
    watchScreenShareAudio,
  };
}
