"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  type LocalTrack,
  type LocalVideoTrack,
  type Participant,
  ParticipantEvent,
  type RemoteTrack,
  type RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";

import { useSound } from "react-sounds";

import { readAudioProcessingPrefs, videoCaptureSettings } from "@/lib/media-prefs";
import { useRealtime } from "@/lib/useRealtime";

export interface CallParticipant {
  identity: string;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
}

export interface ScreenShare {
  track: LocalTrack | RemoteTrack;
  identity: string;
}

/**
 * Loudness (0..1 RMS) above which someone counts as speaking. Low on purpose:
 * the ring should react to any real mic input, not just confident speech.
 */
const SPEAKING_RMS_THRESHOLD = 0.015;

/**
 * Keep the ring lit this long after the last frame over the threshold, so it
 * stays steady through the natural gaps between syllables instead of strobing.
 */
const SPEAKING_HOLD_MS = 250;

/** localhost, loopback, or RFC1918 — addresses that only mean "this network". */
function isLocalAddress(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "::1" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * The voice service builds its LiveKit URL from one server-side env var, so it
 * can only ever name a single host: pick localhost and LAN browsers can't
 * reach it, pick the LAN IP and it's wrong for anyone on the Docker host.
 *
 * When the configured host is a local/private address — i.e. it just means
 * "the machine running the stack" — retarget it at whatever host THIS browser
 * used to reach the app, keeping the configured port. Same approach as the
 * chat socket's resolveWsBase(). A genuinely remote LiveKit deployment (public
 * hostname) is left alone, since there the env var is the only source of truth.
 */
function livekitUrlForThisBrowser(serverUrl: string): string {
  if (typeof window === "undefined") return serverUrl;

  try {
    const url = new URL(serverUrl);

    if (!isLocalAddress(url.hostname)) return serverUrl;

    url.hostname = window.location.hostname;
    // Follow the page's scheme: a wss:// page can't open a ws:// socket.
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    return url.toString();
  } catch {
    return serverUrl;
  }
}

/**
 * Marks the tab as actively playing media. Chrome (and, to a lesser degree,
 * mobile Safari) exempts tabs with an active media session from most of the
 * background-tab timer/JS throttling that otherwise starves LiveKit's
 * signaling pings and gets a backgrounded call dropped -- this is the same
 * lever music/video-call web apps rely on to survive being backgrounded.
 */
function setMediaSessionActive(title: string) {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;

  navigator.mediaSession.metadata = new MediaMetadata({ title });
  navigator.mediaSession.playbackState = "playing";
}

function clearMediaSession() {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;

  navigator.mediaSession.metadata = null;
  navigator.mediaSession.playbackState = "none";
}

interface UseCallState {
  connected: boolean;
  connecting: boolean;
  /** LiveKit is re-establishing a connection that dropped (e.g. a throttled
   *  background tab missing pings) -- still `connected`, just not live yet. */
  reconnecting: boolean;
  participants: CallParticipant[];
  muted: boolean;
  screenSharing: boolean;
  /** Every screen currently being shared, local and remote — one per sharer. */
  screenShares: ScreenShare[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => void;
  /**
   * Leave, unless a join happens first. Use this from an effect cleanup; use
   * `leave` for a deliberate hang-up.
   */
  scheduleLeave: () => void;
  toggleMute: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
}

/**
 * One LiveKit Room per call. The room name is always the conversation id
 * (see the voice service's membership check) -- a group call is just a DM
 * call with more members, LiveKit doesn't distinguish the two.
 */
export function useCall(conversationId: string | null): UseCallState {
  const { send } = useRealtime();
  const roomRef = useRef<Room | null>(null);

  // Someone else arriving/leaving the call. Held in refs because the LiveKit
  // handlers below are registered once inside join() and would otherwise
  // capture the first render's play functions.
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
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speakingIds, setSpeakingIds] = useState<string[]>([]);

  // Our OWN mic is analysed here in the browser rather than via LiveKit's
  // participant.isSpeaking, which comes from the server's audio-level observer
  // -- that only reports every ~400ms and ignores anything under a loudness
  // threshold, so quiet or short input never lit the ring.
  //
  // Deliberately local-only: routing a *remote* WebRTC track through Web Audio
  // is a long-standing source of choppy/dropping playback in Chrome, and it's
  // the same track the <audio> element is playing. Remote participants use
  // LiveKit's isSpeaking instead -- slightly coarser, but it can't break their
  // audio.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef(
    new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>(),
  );

  /**
   * Guards against two joins running at once. `roomRef` alone isn't enough:
   * it's only assigned after `connect()` resolves, so a second join starting
   * during that await would sail past the check and open a SECOND connection
   * with the same identity — LiveKit then kicks one as a duplicate, which
   * tears down the publisher's data channels and makes publishing fail with
   * "engine not connected within timeout". React 18's StrictMode does exactly
   * this in dev by double-invoking effects.
   *
   * `joiningRef` blocks the overlap; the token lets `leave()` disown a join
   * that's still in flight, so its room gets disconnected instead of stranded.
   */
  const joiningRef = useRef(false);
  const joinTokenRef = useRef(0);
  const teardownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addAnalyser = useCallback((identity: string, track: MediaStreamTrack) => {
    try {
      const ctx =
        audioCtxRef.current ??
        (audioCtxRef.current = new AudioContext());

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
  }, []);

  const refreshParticipants = useCallback((room: Room) => {
    const local = room.localParticipant;

    setParticipants([
      {
        identity: local.identity,
        isLocal: true,
        isSpeaking: false, // ours is filled in from the analyser on the way out
        isMuted: !local.isMicrophoneEnabled,
      },
      ...Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        isLocal: false,
        isSpeaking: p.isSpeaking,
        isMuted: !p.isMicrophoneEnabled,
      })),
    ]);
  }, []);

  // Keyed by identity: one share per participant, and re-sharing replaces the
  // previous entry rather than stacking up.
  const addScreenShare = useCallback(
    (identity: string, track: LocalTrack | RemoteTrack) => {
      setScreenShares((prev) => [
        ...prev.filter((s) => s.identity !== identity),
        { identity, track },
      ]);
    },
    [],
  );

  const removeScreenShare = useCallback((identity: string) => {
    setScreenShares((prev) => prev.filter((s) => s.identity !== identity));
  }, []);

  // Periodic console logging of actual (not requested) screen-share quality,
  // keyed so both a local send stream and any number of remote receive
  // streams can run side by side without clobbering each other's bitrate math.
  const screenShareStatsTimersRef = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const prevScreenShareBytesRef = useRef(new Map<string, { bytes: number; at: number }>());
  // What we actually asked the capture for, stashed right before
  // setScreenShareEnabled so the LocalTrackPublished handler -- which only
  // gets the resulting track, not what toggleScreenShare requested -- can log
  // requested vs. actual side by side.
  const requestedScreenShareSettingsRef = useRef<{
    width: number;
    height: number;
    frameRate: number;
    maxBitrate: number;
  } | null>(null);

  const stopScreenShareStatsLogging = useCallback((key: string) => {
    const timer = screenShareStatsTimersRef.current.get(key);

    if (timer) {
      clearInterval(timer);
      screenShareStatsTimersRef.current.delete(key);
    }
    prevScreenShareBytesRef.current.delete(key);
  }, []);

  const startSenderStatsLogging = useCallback((track: LocalVideoTrack) => {
    const key = `send:${track.sid ?? "local-screen"}`;

    stopScreenShareStatsLogging(key);

    const requested = requestedScreenShareSettingsRef.current;
    const actual = track.mediaStreamTrack.getSettings();

    // eslint-disable-next-line no-console
    console.info("[screen-share] capture started", {
      requested: requested
        ? `${requested.width}x${requested.height}@${requested.frameRate}fps, ceiling ${Math.round(requested.maxBitrate / 1000)}kbps`
        : "unknown",
      actual: `${actual.width}x${actual.height}@${actual.frameRate}fps`,
    });

    screenShareStatsTimersRef.current.set(
      key,
      setInterval(async () => {
        const [stats] = await track.getSenderStats();

        if (!stats) return;

        const now = stats.timestamp;
        const prev = prevScreenShareBytesRef.current.get(key);
        const bitrateKbps =
          prev && stats.bytesSent !== undefined && now > prev.at
            ? Math.round(((stats.bytesSent - prev.bytes) * 8) / (now - prev.at))
            : undefined;

        prevScreenShareBytesRef.current.set(key, { bytes: stats.bytesSent ?? 0, at: now });

        // eslint-disable-next-line no-console
        console.info("[screen-share] sending", {
          resolution: `${stats.frameWidth ?? "?"}x${stats.frameHeight ?? "?"}`,
          fps: stats.framesPerSecond,
          targetKbps: stats.targetBitrate ? Math.round(stats.targetBitrate / 1000) : undefined,
          actualKbps: bitrateKbps,
          qualityLimitationReason: stats.qualityLimitationReason,
        });
      }, 3000),
    );
  }, [stopScreenShareStatsLogging]);

  const startReceiverStatsLogging = useCallback(
    (track: RemoteVideoTrack, identity: string) => {
      const key = `recv:${identity}:${track.sid ?? ""}`;

      stopScreenShareStatsLogging(key);

      screenShareStatsTimersRef.current.set(
        key,
        setInterval(async () => {
          const stats = await track.getReceiverStats();

          if (!stats) return;

          const now = stats.timestamp;
          const prev = prevScreenShareBytesRef.current.get(key);
          const bitrateKbps =
            prev && stats.bytesReceived !== undefined && now > prev.at
              ? Math.round(((stats.bytesReceived - prev.bytes) * 8) / (now - prev.at))
              : undefined;

          prevScreenShareBytesRef.current.set(key, { bytes: stats.bytesReceived ?? 0, at: now });

          const framesDecoded = stats.framesDecoded;
          const decoderImplementation = stats.decoderImplementation;

          // eslint-disable-next-line no-console
          console.info(`[screen-share] receiving from ${identity}`, {
            resolution: `${stats.frameWidth ?? "?"}x${stats.frameHeight ?? "?"}`,
            framesDecoded,
            framesDropped: stats.framesDropped,
            actualKbps: bitrateKbps,
            decoderImplementation,
          });
        }, 3000),
      );
    },
    [stopScreenShareStatsLogging],
  );

  const stopAllScreenShareStatsLogging = useCallback(() => {
    screenShareStatsTimersRef.current.forEach((timer) => clearInterval(timer));
    screenShareStatsTimersRef.current.clear();
    prevScreenShareBytesRef.current.clear();
  }, []);

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
  }, []);

  /**
   * Turn the mic on, retrying briefly.
   *
   * Publishing needs the publisher transport up, which races `connect()`
   * resolving — LiveKit rejects with "engine not connected within timeout" if
   * it isn't ready, and its data channels can be torn down and rebuilt while
   * the transport settles. That's transient, so a couple of spaced attempts
   * clears it; returns false only if the mic genuinely won't start.
   */
  const publishMic = useCallback(async (room: Room) => {
    const prefs = readAudioProcessingPrefs();
    const options = {
      noiseSuppression: prefs.noiseSuppression,
      echoCancellation: prefs.echoCancellation,
      autoGainControl: true,
    };

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
    // ...and release the in-flight claim, so a join that comes straight after
    // this (React's mount → cleanup → mount in StrictMode) isn't blocked by
    // the one we just cancelled. Without this the remount's join bails out and
    // the cancelled one disconnects, leaving no connection at all.
    joiningRef.current = false;

    const room = roomRef.current;

    roomRef.current = null;

    if (room) {
      room.disconnect();
      // Only announce leaving a call we actually joined; a cancelled join
      // never told anyone it had started.
      if (conversationId) send({ type: "CALL_ENDED", conversationId });
      playLeaveRef.current().catch(() => {});
    }

    teardownAudio();
    stopAllScreenShareStatsLogging();
    clearMediaSession();
    setConnected(false);
    setReconnecting(false);
    setParticipants([]);
    setSpeakingIds([]);
    setScreenSharing(false);
    setScreenShares([]);
    setMuted(false);
  }, [conversationId, send, teardownAudio, stopAllScreenShareStatsLogging]);

  /**
   * Deferred teardown for effect cleanups.
   *
   * React StrictMode mounts → unmounts → mounts in dev. Leaving synchronously
   * on that throwaway unmount meant the whole call was rebuilt: a second token
   * fetch, a second connect(), a briefly duplicated identity in LiveKit and a
   * spurious connection error from the copy being discarded. Deferring by a
   * macrotask lets the immediate remount cancel it (see join), so dev behaves
   * like production and connects exactly once. A real unmount has no remount
   * to cancel it, so the timer fires and we leave normally.
   */
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
        prev.length === speaking.length && speaking.every((id) => prev.includes(id))
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
    // A pending deferred teardown means we're in StrictMode's throwaway
    // mount → cleanup → mount (or a fast leave/rejoin). Cancel it and keep the
    // connection we already have instead of rebuilding it.
    if (teardownTimerRef.current) {
      clearTimeout(teardownTimerRef.current);
      teardownTimerRef.current = null;
    }

    if (!conversationId || roomRef.current || joiningRef.current) return;

    // Claimed synchronously, before the first await. Because the teardown
    // above was deferred rather than run, StrictMode's remount finds this
    // still set and returns -- so dev does exactly one token fetch and one
    // connect(), the same as production.
    joiningRef.current = true;

    const joinToken = ++joinTokenRef.current;

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch(`/api/voice/rooms/${conversationId}/token`, {
        method: "POST",
      });

      if (!res.ok) {
        setError("Could not join the call.");

        return;
      }

      const { serverUrl, token } = (await res.json()) as {
        serverUrl: string;
        token: string;
      };

      const room = new Room();

      // Remote speaking comes from LiveKit; isSpeakingChanged is per-participant
      // and more reliable than the room-level ActiveSpeakersChanged aggregate.
      const wireRemote = (p: Participant) =>
        p.on(ParticipantEvent.IsSpeakingChanged, () => refreshParticipants(room));

      room.on(RoomEvent.ParticipantConnected, (p) => {
        wireRemote(p);
        refreshParticipants(room);
        playJoinRef.current().catch(() => {});
      });
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        removeScreenShare(p.identity);
        refreshParticipants(room);
        playLeaveRef.current().catch(() => {});
      });
      room.on(RoomEvent.TrackMuted, () => refreshParticipants(room));
      room.on(RoomEvent.TrackUnmuted, () => refreshParticipants(room));

      // Notify other conversation members as soon as the room is actually
      // connected (fires on the initial connect and on any reconnect) --
      // decoupled from the rest of join() so a later failure (e.g. the mic
      // permission prompt) can't silently swallow the notification.
      room.on(RoomEvent.Connected, () => {
        if (conversationId) send({ type: "CALL_STARTED", conversationId });
      });

      // Remote audio doesn't play itself -- attach each subscribed track to a
      // hidden <audio> element and clean it up once unsubscribed. A remote
      // screen share is video, not auto-played anywhere -- surface the Track
      // itself so CallPanel can attach it to a visible <video>.
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();

          el.autoplay = true;
          el.dataset.livekitTrack = track.sid ?? "";
          document.body.appendChild(el);
        }
        if (track.source === Track.Source.ScreenShare) {
          addScreenShare(participant.identity, track);
          startReceiverStatsLogging(track as RemoteVideoTrack, participant.identity);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
        track.detach().forEach((el) => el.remove());
        if (track.source === Track.Source.ScreenShare) {
          removeScreenShare(participant.identity);
          stopScreenShareStatsLogging(`recv:${participant.identity}:${track.sid ?? ""}`);
        }
      });

      // Local screen share never fires TrackSubscribed (that's remote-only) --
      // this is what gives the sharer their own preview, and also what catches
      // the browser's native "Stop sharing" bar bypassing toggleScreenShare.
      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShare && publication.track) {
          addScreenShare(participant.identity, publication.track);
          startSenderStatsLogging(publication.track as LocalVideoTrack);
        }
        // Unmuting republishes the mic as a NEW capture track, so the old
        // analyser would be reading a dead one -- re-point it at the new track.
        if (publication.source === Track.Source.Microphone && publication.track) {
          addAnalyser(participant.identity, publication.track.mediaStreamTrack);
        }
      });
      room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShare) {
          setScreenSharing(false);
          // Keyed by identity, not publication.track -- LiveKit clears that
          // reference before/while emitting this event, so matching on it
          // never fired and the stale last frame stayed on screen.
          removeScreenShare(participant.identity);
          stopScreenShareStatsLogging(`send:${publication.trackSid}`);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setConnected(false);
        setReconnecting(false);
        setParticipants([]);
        setScreenShares([]);
        stopAllScreenShareStatsLogging();
        clearMediaSession();
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Disconnected) setConnected(false);
      });

      // LiveKit's own reconnect (e.g. after a throttled background tab missed
      // its pings and got dropped) -- surface it as "reconnecting" rather than
      // letting the call silently look dead with no way back short of leaving
      // and rejoining.
      room.on(RoomEvent.Reconnecting, () => setReconnecting(true));
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

      // We're in the call now. Commit that BEFORE touching the mic: publishing
      // is a separate step that can fail on its own, and if it does we're
      // still connected -- bailing out here would leave the controls dead
      // (roomRef null) and the UI stuck on "Connecting…" while audio flowed.
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
          addAnalyser(room.localParticipant.identity, micTrack.mediaStreamTrack);
        }
        setMuted(false);
      } else {
        // In the call, just not publishing. Surfaced as muted so the mic button
        // is the obvious way to retry.
        setMuted(true);
        setError("You're connected, but your microphone didn't start. Use the mic button to retry.");
      }

      refreshParticipants(room);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to join call", err);
      setError(
        err instanceof Error ? `Could not join the call: ${err.message}` : "Could not join the call.",
      );
    } finally {
      // Only release the claim if we're still the current join -- a cancelled
      // one finishing late must not clear the flag (or the spinner) belonging
      // to the join that replaced it.
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
    addScreenShare,
    removeScreenShare,
    startSenderStatsLogging,
    startReceiverStatsLogging,
    stopScreenShareStatsLogging,
    stopAllScreenShareStatsLogging,
  ]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    if (muted) {
      // Also the retry path when the mic failed to start on join, so it goes
      // through publishMic rather than a bare one-shot enable.
      if (await publishMic(room)) {
        setMuted(false);
        setError(null);

        const micTrack = room.localParticipant.getTrackPublication(
          Track.Source.Microphone,
        )?.track;

        if (micTrack) {
          addAnalyser(room.localParticipant.identity, micTrack.mediaStreamTrack);
        }
      } else {
        setError("Your microphone still didn't start.");
      }

      return;
    }

    await room.localParticipant.setMicrophoneEnabled(false);
    setMuted(true);
  }, [muted, publishMic, addAnalyser]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    const next = !screenSharing;

    try {
      const { resolution, maxBitrate, maxFramerate } = videoCaptureSettings();

      // Read by startSenderStatsLogging (via LocalTrackPublished) to log
      // what we asked for next to what the capture actually produced.
      requestedScreenShareSettingsRef.current = next
        ? { width: resolution.width, height: resolution.height, frameRate: maxFramerate, maxBitrate }
        : null;

      await room.localParticipant.setScreenShareEnabled(
        next,
        // Capture side: how many pixels/frames we grab off the screen.
        // contentHint "motion" -- we want the encoder spending its cycles on
        // keeping every frame arriving on time (a "live" feel) rather than
        // squeezing extra sharpness out of each one at the cost of frame rate.
        { resolution, contentHint: "motion" },
        {
          // MUST be screenShareEncoding, not videoEncoding -- LiveKit reads
          // the latter only for camera tracks and silently ignores it here,
          // falling back to its own default bitrate.
          screenShareEncoding: { maxBitrate, maxFramerate, priority: "high" },
          // VP8 (LiveKit's default) has no hardware encoder in Chrome -- every
          // frame is software-encoded on one CPU thread, and at 1080p+ that
          // work is what was capping us at ~10-40fps regardless of how fast
          // the machine otherwise is (confirmed via webrtc-internals:
          // encoderImplementation=libvpx, powerEfficientEncoder=false).
          // H.264 has a real hardware encode path on most platforms; falling
          // back to VP8 automatically for browsers that can't do H.264.
          videoCodec: "h264",
          backupCodec: true,
          // Simulcast splits maxBitrate across several encoded layers instead
          // of giving it all to one -- with it on, the single stream we
          // actually watch gets a fraction of the budget we configured.
          simulcast: false,
          // Give up resolution before frame rate under pressure -- a
          // downscaled-but-live 60fps share beats a full-res slideshow.
          degradationPreference: "maintain-framerate",
        },
      );
      setScreenSharing(next);
    } catch {
      // Screen picker was cancelled, or unsupported in this browser -- no-op.
    }
  }, [screenSharing]);

  return {
    connected,
    connecting,
    reconnecting,
    // Ours is analyser-driven (instant, catches any input); everyone else's
    // comes from LiveKit, already on the roster.
    participants: participants.map((p) => ({
      ...p,
      isSpeaking:
        !p.isMuted && (p.isLocal ? speakingIds.includes(p.identity) : p.isSpeaking),
    })),
    muted,
    screenSharing,
    screenShares,
    error,
    join,
    leave,
    scheduleLeave,
    toggleMute,
    toggleScreenShare,
  };
}
