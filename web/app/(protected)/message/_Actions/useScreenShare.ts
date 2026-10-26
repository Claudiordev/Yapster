"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { AudioPresets, type LocalTrack, type LocalVideoTrack, type RemoteTrack, type RemoteVideoTrack, Room, RoomEvent, Track, type TrackPublishOptions } from "livekit-client";

import { addToast } from "@heroui/toast";
import { useSound } from "react-sounds";
import { DEFAULT_SCREEN_SHARE_AUDIO, getScreenShareRoles, onScreenSharePrefsChanged, readScreenShareAudioPref, VIDEO_RESOLUTION_KEY } from "@/lib/mediaPrefs";
import type { ScreenShare } from "@/types/call";
import { clearStartBitrateTarget, setStartBitrateTarget } from "./utils/startBitrateOverride";
import { pickDesktopScreenShare } from "./utils/desktopScreenShare";
import { currentFrameSize, describeCaptureFit, enforceConfiguredScreenShareSender, fitCaptureToTarget, reconcileCaptureWithFrames, restoreConfiguredScreenShare } from "./utils/screenShareSender";
import { buildScreenShareVideoOptions, resolveScreenShareTarget } from "./utils/screenShareTarget";
import { selectScreenShareCodec } from "./utils/screenShareCodec";
import { useScreenShareStats } from "./useScreenShareStats";

interface UseScreenShareArgs {
  /** The call's room, owned by useCall. */
  roomRef: MutableRefObject<Room | null>;
  /** useCall's output gain (deafen and master volume), applied to screen-share audio. */
  gain: (volume: number) => number;
  /** useCall's banner error. */
  setError: (message: string | null) => void;
}
// Volume screen share
const MAX_CODEC_SWITCHES = 2;

const clampVolume = (value: number) => Math.round(Math.min(200, Math.max(0, value)));

/**
 * Screen sharing in a call: our own share (capture, encoder settings, recovery
 * after a reconnect) and other people's (state, audio, volume). useCall owns the
 * room and calls `attachScreenShareListeners(room)` once per join.
 */
export function useScreenShare({ roomRef, gain, setError }: UseScreenShareArgs) {
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const { requestedSettingsRef, onCpuLimitedRef, onEncoderStalledRef, startSenderStatsLogging, startReceiverStatsLogging, stopScreenShareStatsLogging, stopAllScreenShareStatsLogging } = useScreenShareStats();
  const watchedScreenShareAudioRef = useRef<string | null>(null);
  const pendingAudioTracksRef = useRef(new Map<string, LocalTrack | RemoteTrack>());
  const volumesRef = useRef(new Map<string, number>());
  const screenAudioEnabledRef = useRef(DEFAULT_SCREEN_SHARE_AUDIO);
  const recoveringRef = useRef(false);
  /** The options the video track was published with, reused to republish it on another codec. */
  const publishOptionsRef = useRef<TrackPublishOptions | null>(null);
  const switchingCodecRef = useRef(false);
  const codecSwitchesRef = useRef(0);

  // Started sharing blip
  const { play: playShareStart } = useSound("ui/success_blip", { volume: 0.5 });
  const playShareStartRef = useRef(playShareStart);
  const announcedRef = useRef(new Set<string>());
  const connectedAtRef = useRef(0);

  // `gain` only reads refs, keep the latest in a ref rather than re-creating every callback.
  const gainRef = useRef(gain);
  gainRef.current = gain;

  useEffect(() => {
    screenAudioEnabledRef.current = readScreenShareAudioPref();
  }, []);

  useEffect(() => {
    playShareStartRef.current = playShareStart;
  }, [playShareStart]);

  const announceScreenShare = useCallback((identity: string, local: boolean) => {
    if (announcedRef.current.has(identity)) return;

    announcedRef.current.add(identity);

    const alreadyRunning = !local && Date.now() - connectedAtRef.current < 3000;

    if (!alreadyRunning) playShareStartRef.current().catch(() => {});
  }, []);

  const noteConnected = useCallback(() => {
    connectedAtRef.current = Date.now();
  }, []);

  // ── Shares and their audio ──────────────────────────────────────────────────
  const screenShareVolume = useCallback((identity: string) => {
    const existing = volumesRef.current.get(identity);

    if (existing != null) return existing;

    const saved = localStorage.getItem(`screen-share-volume:${identity}`);
    const stored = saved == null ? Number.NaN : Number(saved);
    const volume = Number.isFinite(stored) ? Math.min(200, Math.max(0, stored)) : 100;

    volumesRef.current.set(identity, volume);

    return volume;
  }, []);

  const setScreenShareVolume = useCallback(
    (identity: string, value: number) => {
      const volume = clampVolume(value);

      volumesRef.current.set(identity, volume);
      localStorage.setItem(`screen-share-volume:${identity}`, String(volume));
      roomRef.current?.remoteParticipants.get(identity)?.setVolume(gainRef.current(watchedScreenShareAudioRef.current === identity ? volume / 100 : 0), Track.Source.ScreenShareAudio);
      setScreenShares((current) => current.map((share) => (share.identity === identity ? { ...share, audioVolume: volume } : share)));
    },
    [roomRef],
  );

  /** Play only this share's audio (null stops listening); it's a separate publication from the video. */
  const watchScreenShareAudio = useCallback(
    (identity: string | null) => {
      const room = roomRef.current;
      const previous = watchedScreenShareAudioRef.current;

      if (room && previous && previous !== identity) {
        const previousParticipant = room.remoteParticipants.get(previous);
        const previousPublication = previousParticipant?.getTrackPublication(Track.Source.ScreenShareAudio);

        previousParticipant?.setVolume(0, Track.Source.ScreenShareAudio);
        previousPublication?.setEnabled(false);
        previousPublication?.setSubscribed(false);
      }

      watchedScreenShareAudioRef.current = identity;

      if (!identity) return;

      const remote = room?.remoteParticipants.get(identity)?.getTrackPublication(Track.Source.ScreenShareAudio);
      const local = room?.localParticipant.identity === identity ? room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio) : undefined;

      setError(!remote && !local ? "This screen share is not publishing an audio track. The sender must restart the share, select the YouTube tab, and enable Share tab audio." : null);

      room?.remoteParticipants.get(identity)?.setVolume(gainRef.current(screenShareVolume(identity) / 100), Track.Source.ScreenShareAudio);
      remote?.setSubscribed(true);
      remote?.setEnabled(true);

      // Called from the Watch click, so LiveKit can unlock audio inside the user gesture.
      void room?.startAudio().catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("Could not enable call audio", error);
      });
    },
    [roomRef, screenShareVolume, setError],
  );

  // One share per participant: re-sharing replaces the entry.
  const addScreenShare = useCallback(
    (identity: string, track: LocalTrack | RemoteTrack) => {
      const audioTrack = pendingAudioTracksRef.current.get(identity);

      setScreenShares((prev) => [...prev.filter((s) => s.identity !== identity), { identity, track, audioTrack, audioVolume: screenShareVolume(identity) }]);
    },
    [screenShareVolume],
  );

  const addScreenShareAudio = useCallback((identity: string, audioTrack: LocalTrack | RemoteTrack) => {
    pendingAudioTracksRef.current.set(identity, audioTrack);
    setScreenShares((prev) => prev.map((share) => (share.identity === identity ? { ...share, audioTrack } : share)));
  }, []);

  const removeScreenShareAudio = useCallback((identity: string) => {
    pendingAudioTracksRef.current.delete(identity);
    setScreenShares((prev) =>
      prev.map((share) => {
        if (share.identity !== identity) return share;

        const { audioTrack: _audioTrack, ...videoShare } = share;

        return videoShare;
      }),
    );
  }, []);

  const removeScreenShare = useCallback((identity: string) => {
    announcedRef.current.delete(identity);
    pendingAudioTracksRef.current.delete(identity);
    setScreenShares((prev) => prev.filter((s) => s.identity !== identity));
  }, []);

  // ── Our own share ───────────────────────────────────────────────────────────
  const setConfiguredScreenShareEnabled = useCallback(
    async (room: Room, enabled: boolean, includeAudio = screenAudioEnabledRef.current) => {
      const target = resolveScreenShareTarget();

      // Pick the codec this browser encodes best (hardware over software) at these settings.
      const { codec, support } = enabled
        ? await selectScreenShareCodec({ width: target.width, height: target.height, framerate: target.frameRate, bitrate: target.maxBitrate })
        : { codec: "vp8" as const, support: "software" as const };
      // The track is gone once disabled, so grab its id first to clear its start-bitrate target.
      const outgoingTrackId = enabled ? undefined : (room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined)?.mediaStreamTrack.id;

      let sized = target;

      if (!enabled) {
        requestedSettingsRef.current = null;
        publishOptionsRef.current = null;
        await room.localParticipant.setScreenShareEnabled(false);
      } else {
        // Why this resolution: the saved choice, what the roles allow, and where it was read.
        // eslint-disable-next-line no-console
        console.info("[screen-share] resolution", { saved: localStorage.getItem(VIDEO_RESOLUTION_KEY), inEffect: `${target.width}x${target.height}`, ceilingKbps: Math.round(target.maxBitrate / 1000), roles: getScreenShareRoles().join(","), origin: location.origin });

        // Capture at the screen's native size, fit it to the pixel budget, then publish what we fitted.
        const tracks = await room.localParticipant.createScreenTracks({
          ...buildScreenShareVideoOptions(target, codec).capture,
          // Chrome only provides audio if the user ticks "Share tab audio" in its picker.
          audio: includeAudio
            ? {
                restrictOwnAudio: { ideal: true },
                // Screen audio is music/media: no voice processing, stereo 48 kHz.
                channelCount: 2,
                sampleRate: 48_000,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              }
            : false,
          systemAudio: includeAudio ? "include" : "exclude",
          suppressLocalAudioPlayback: false,
        });
        const videoTrack = tracks.find((track) => track.kind === Track.Kind.Video);

        try {
          if (videoTrack) {
            const fit = await fitCaptureToTarget(videoTrack.mediaStreamTrack, target);

            // eslint-disable-next-line no-console
            console.info("[screen-share] capture fitted", describeCaptureFit(fit));
            sized = resolveScreenShareTarget({}, fit.final ?? videoTrack.mediaStreamTrack.getSettings());
          }

          const publishOptions: TrackPublishOptions = {
            ...buildScreenShareVideoOptions(sized, codec).publish,
            audioPreset: AudioPresets.musicHighQualityStereo,
            forceStereo: true,
            dtx: true,
            red: false,
            // Same stream as the video, for A/V sync on viewers.
            stream: "screen-share",
          };

          requestedSettingsRef.current = { width: sized.width, height: sized.height, frameRate: sized.frameRate, maxBitrate: sized.maxBitrate, codec, support };
          publishOptionsRef.current = publishOptions;
          codecSwitchesRef.current = 0;

          await Promise.all(tracks.map((track) => room.localParticipant.publishTrack(track, publishOptions)));
        } catch (error) {
          tracks.forEach((track) => track.stop());
          requestedSettingsRef.current = null;
          publishOptionsRef.current = null;
          throw error;
        }
      }

      const screenTrack = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined;

      // Forces the full start bitrate instead of LiveKit's ~90% hint (see startBitrateOverride.ts).
      // The codec must match the videoCodec above.
      if (enabled && screenTrack) setStartBitrateTarget(screenTrack.mediaStreamTrack.id, codec, sized.maxBitrate / 1000);
      else if (outgoingTrackId) clearStartBitrateTarget(outgoingTrackId);
    },
    [requestedSettingsRef],
  );

  /**
   * Move a running share to the next-best codec without stopping the capture:
   * unpublish the video track (keeping the browser's capture alive, so no picker)
   * and publish it again. Viewers see the share drop and return for a moment.
   * Limited to a couple of switches per share, so it can't ping-pong.
   */
  const switchScreenShareCodec = useCallback(async (): Promise<"switched" | "none" | "busy" | "failed"> => {
    const room = roomRef.current;
    const track = room?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined;
    const current = requestedSettingsRef.current;
    const baseOptions = publishOptionsRef.current;

    if (!room || !track || !current || !baseOptions) return "busy";
    if (switchingCodecRef.current || recoveringRef.current) return "busy";
    if (codecSwitchesRef.current >= MAX_CODEC_SWITCHES) return "none";

    const target = resolveScreenShareTarget({}, track.mediaStreamTrack.getSettings());
    const next = await selectScreenShareCodec({ width: target.width, height: target.height, framerate: target.frameRate, bitrate: target.maxBitrate });

    // Nothing better to move to (the current codec is already the best left).
    if (next.codec === current.codec || next.cpuLimited) return "none";

    switchingCodecRef.current = true;
    codecSwitchesRef.current += 1;
    try {
      const options: TrackPublishOptions = { ...baseOptions, ...buildScreenShareVideoOptions(target, next.codec).publish };

      requestedSettingsRef.current = { ...current, codec: next.codec, support: next.support };
      publishOptionsRef.current = options;
      // Registered before publishing so the new offer already carries the start bitrate for the new codec.
      setStartBitrateTarget(track.mediaStreamTrack.id, next.codec, target.maxBitrate / 1000);

      await room.localParticipant.unpublishTrack(track, false);
      await room.localParticipant.publishTrack(track, options);
      setScreenSharing(true);

      // eslint-disable-next-line no-console
      console.info("[screen-share] switched codec", { from: current.codec, to: next.codec });
      addToast({ title: "Screen share adjusted", description: "Your computer was struggling, so the share switched to a lighter video format." });

      return "switched";
    } catch (error) {
      console.error("Could not switch the screen share codec", error);
      track.stop();
      clearStartBitrateTarget(track.mediaStreamTrack.id);
      setScreenSharing(false);
      addToast({ color: "warning", title: "Screen share stopped", description: "Switching video format failed. Start sharing again." });

      return "failed";
    } finally {
      switchingCodecRef.current = false;
    }
  }, [requestedSettingsRef, roomRef]);

  useEffect(() => {
    onCpuLimitedRef.current = () => void switchScreenShareCodec();
    onEncoderStalledRef.current = () => {
      void switchScreenShareCodec().then((result) => {
        if (result === "none") addToast({ color: "warning", title: "Screen share isn't encoding", description: "Your video encoder isn't producing frames. Stop and start the share again." });
      });
    };
  }, [onCpuLimitedRef, onEncoderStalledRef, switchScreenShareCodec]);

  /** After LiveKit replaces its publisher, put the share back at the configured settings. */
  const recoverScreenShareAfterReconnect = useCallback(
    async (room: Room) => {
      if (recoveringRef.current) return;

      const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined;

      if (!track) return;

      recoveringRef.current = true;
      try {
        try {
          await restoreConfiguredScreenShare(track);
          startSenderStatsLogging(track);
        } catch (error) {
          // The track may point at a sender from the discarded connection;
          // reacquiring (the picker may reappear) beats publishing a broken one.
          console.warn("Could not restore the screen share after reconnect; reacquiring it", error);
          await setConfiguredScreenShareEnabled(room, false);
          await setConfiguredScreenShareEnabled(room, true);
        }
      } catch (error) {
        console.error("Could not recover the screen share after reconnect", error);
        setScreenSharing(false);
        addToast({ color: "warning", title: "Screen share stopped", description: "The connection recovered, but screen sharing must be started again." });
      } finally {
        recoveringRef.current = false;
      }
    },
    [setConfiguredScreenShareEnabled, startSenderStatsLogging],
  );

  // Mode or resolution changed in Settings while sharing: apply it to the live sender.
  useEffect(() => {
    if (!screenSharing) return;

    return onScreenSharePrefsChanged(() => {
      const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track as LocalVideoTrack | undefined;

      if (!track) return;

      // Resolution or stream type changed: re-fit the capture and re-size the ceiling from the real frames.
      void currentFrameSize(track)
        .then(async (frame) => {
          if (frame) await reconcileCaptureWithFrames(track, frame);
          else await enforceConfiguredScreenShareSender(track);
        })
        .catch(() => {});
    });
  }, [roomRef, screenSharing]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;

    if (!room) return;

    const next = !screenSharing;

    try {
      // Desktop app: pick the source and quality in one modal first.
      if (next && !(await pickDesktopScreenShare(getScreenShareRoles()))) return;

      const includeAudio = next ? readScreenShareAudioPref() : screenAudioEnabledRef.current;

      screenAudioEnabledRef.current = includeAudio;
      await setConfiguredScreenShareEnabled(room, next, includeAudio);
      setScreenSharing(next);

      if (next && includeAudio && !room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio)) {
        setError('Chrome did not provide shared audio. Select a browser tab and enable "Share tab audio" in the picker.');
      } else if (next) {
        setError(null);
      }
    } catch {
      // Picker cancelled, or screen capture unsupported here.
    }
  }, [roomRef, screenSharing, setConfiguredScreenShareEnabled, setError]);

  // ── Room events ─────────────────────────────────────────────────────────────
  /** Registers every screen-share room event, alongside useCall's own handlers for the same events. */
  const attachScreenShareListeners = useCallback(
    (room: Room) => {
      room.on(RoomEvent.ParticipantDisconnected, (participant) => removeScreenShare(participant.identity));

      // We never mute our own share, so this is the voice service suspending a
      // share above what our roles allow: end it rather than leave a frozen tile.
      room.on(RoomEvent.TrackMuted, (publication, participant) => {
        if (!participant.isLocal || publication.source !== Track.Source.ScreenShare) return;

        addToast({ color: "warning", title: "Screen share stopped", description: "Your plan doesn't include that resolution. Pick a lower one in Settings." });
        void setConfiguredScreenShareEnabled(room, false);
      });

      // Screen audio stays disabled and unsubscribed until the viewer watches that share.
      room.on(RoomEvent.TrackPublished, (publication, participant) => {
        if (publication.source !== Track.Source.ScreenShareAudio) return;

        const isWatched = watchedScreenShareAudioRef.current === participant.identity;

        participant.setVolume(gainRef.current(isWatched ? screenShareVolume(participant.identity) / 100 : 0), Track.Source.ScreenShareAudio);
        publication.setEnabled(isWatched);
        publication.setSubscribed(isWatched);
        if (isWatched) setError(null);
      });

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (publication.source === Track.Source.ScreenShareAudio) {
          const isWatched = watchedScreenShareAudioRef.current === participant.identity;

          participant.setVolume(gainRef.current(isWatched ? screenShareVolume(participant.identity) / 100 : 0), Track.Source.ScreenShareAudio);
          publication.setEnabled(isWatched);
          if (isWatched) addScreenShareAudio(participant.identity, track);
          else publication.setSubscribed(false);
        }
        if (publication.source === Track.Source.ScreenShare) {
          addScreenShare(participant.identity, track);
          announceScreenShare(participant.identity, false);
          startReceiverStatsLogging(track as RemoteVideoTrack, participant.identity);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (publication.source === Track.Source.ScreenShareAudio) removeScreenShareAudio(participant.identity);
        if (publication.source === Track.Source.ScreenShare) {
          removeScreenShare(participant.identity);
          stopScreenShareStatsLogging(`recv:${participant.identity}:${track.sid ?? ""}`);
        }
      });

      // Local tracks never fire TrackSubscribed: this gives the sharer their own
      // preview, and catches the browser's "Stop sharing" bar bypassing the toggle.
      room.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
        if (!publication.track) return;

        if (publication.source === Track.Source.ScreenShare) {
          addScreenShare(participant.identity, publication.track);
          announceScreenShare(participant.identity, true);
          startSenderStatsLogging(publication.track as LocalVideoTrack);
        }
        if (publication.source === Track.Source.ScreenShareAudio) {
          const mediaTrack = publication.track.mediaStreamTrack;

          addScreenShareAudio(participant.identity, publication.track);
          // Fidelity hints, applied after Chrome returns the track; they must not block capture.
          mediaTrack.contentHint = "music";
          void mediaTrack.applyConstraints({ channelCount: 2, sampleRate: 48_000, echoCancellation: false, noiseSuppression: false, autoGainControl: false }).catch(() => {});
        }
      });

      room.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShareAudio) removeScreenShareAudio(participant.identity);
        if (publication.source === Track.Source.ScreenShare) {
          stopScreenShareStatsLogging(`send:${publication.trackSid}`);
          // A codec switch republishes right away: keep the tile and the sharing state.
          if (switchingCodecRef.current) return;

          setScreenSharing(false);
          // By identity: LiveKit clears publication.track before emitting this.
          removeScreenShare(participant.identity);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        watchedScreenShareAudioRef.current = null;
        setScreenShares([]);
        pendingAudioTracksRef.current.clear();
        announcedRef.current.clear();
        stopAllScreenShareStatsLogging();
      });

      room.on(RoomEvent.Reconnecting, () => {
        const publication = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);

        if (publication) stopScreenShareStatsLogging(`send:${publication.trackSid}`);
      });
      room.on(RoomEvent.Reconnected, () => void recoverScreenShareAfterReconnect(room));
    },
    [addScreenShare, addScreenShareAudio, announceScreenShare, recoverScreenShareAfterReconnect, removeScreenShare, removeScreenShareAudio, screenShareVolume, setConfiguredScreenShareEnabled, setError, startReceiverStatsLogging, startSenderStatsLogging, stopAllScreenShareStatsLogging, stopScreenShareStatsLogging],
  );

  /** Clear everything when the call is left. */
  const resetScreenShares = useCallback(() => {
    stopAllScreenShareStatsLogging();
    setScreenSharing(false);
    setScreenShares([]);
  }, [stopAllScreenShareStatsLogging]);

  return { screenSharing, screenShares, toggleScreenShare, setScreenShareVolume, watchScreenShareAudio, screenShareVolume, watchedScreenShareAudioRef, attachScreenShareListeners, noteConnected, resetScreenShares, stopAllScreenShareStatsLogging };
}
