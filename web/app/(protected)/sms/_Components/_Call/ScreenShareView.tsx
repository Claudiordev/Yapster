"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";

import type { ScreenShare } from "./useCall";

import { Icon } from "@/components/icon";

interface ScreenShareTileProps {
  share: ScreenShare;
  /** Display name of whoever is sharing. */
  name: string;
  onWatch: () => void;
}

/**
 * Compact placeholder for a screen someone is sharing. Nothing is decoded
 * until it's actually watched, so a call with several sharers doesn't pay for
 * every stream at once.
 */
export function ScreenShareTile({ name, onWatch }: ScreenShareTileProps) {
  return (
    <div className="flex w-44 flex-col items-center gap-2 rounded-medium bg-black p-4">
      <Icon className="text-default-300" name="screen-share" size={30} />
      <span className="max-w-full truncate text-tiny text-default-300">
        {name} is sharing
      </span>
      <Button className="bg-default-200 text-black" size="sm" onPress={onWatch}>
        Watch stream
      </Button>
    </div>
  );
}

interface ScreenShareStageProps {
  share: ScreenShare;
  name: string;
  onClose: () => void;
}

interface ScreenShareAudioProps {
  enabled: boolean;
  track?: ScreenShare["audioTrack"];
}

/** Keeps display audio attached before the Watch click so autoplay is unlocked. */
export function ScreenShareAudio({ enabled, track }: ScreenShareAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const el = audioRef.current;

    if (!el || !track) return;

    el.autoplay = true;
    el.muted = !enabled;
    track.attach(el);

    const logPlaybackState = (event: string) => {
      const mediaTrack = track.mediaStreamTrack;
      // eslint-disable-next-line no-console
      console.info("[screen-share-audio] playback", {
        event,
        enabled: enabledRef.current,
        trackSid: track.sid,
        trackKind: track.kind,
        trackReadyState: mediaTrack.readyState,
        trackMuted: mediaTrack.muted,
        elementMuted: el.muted,
        elementVolume: el.volume,
        elementPaused: el.paused,
        elementReadyState: el.readyState,
        elementNetworkState: el.networkState,
        currentTime: el.currentTime,
        attachedTracks:
          el.srcObject instanceof MediaStream
            ? el.srcObject.getTracks().map((sourceTrack) => ({
                kind: sourceTrack.kind,
                readyState: sourceTrack.readyState,
                muted: sourceTrack.muted,
              }))
            : [],
      });
    };

    const onPlay = () => logPlaybackState("play");
    const onPause = () => logPlaybackState("pause");
    const onWaiting = () => logPlaybackState("waiting");
    const onStalled = () => logPlaybackState("stalled");
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("stalled", onStalled);

    logPlaybackState("attached");
    void el.play().then(
      () => logPlaybackState("play-resolved"),
      (error: unknown) => {
        // eslint-disable-next-line no-console
        console.warn("[screen-share-audio] play-rejected", {
          error,
          enabled,
          trackSid: track.sid,
        });
        logPlaybackState("play-rejected");
      },
    );

    const diagnosticsTimer = window.setInterval(() => {
      logPlaybackState("interval");
    }, 1000);

    return () => {
      window.clearInterval(diagnosticsTimer);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("stalled", onStalled);
      track.detach(el);
      el.pause();
      el.srcObject = null;
    };
  }, [enabled, track]);

  useEffect(() => {
    const el = audioRef.current;

    if (!el || !track) return;

    el.muted = !enabledRef.current;
    // eslint-disable-next-line no-console
    console.info("[screen-share-audio] watch-state-changed", {
      enabled,
      trackSid: track.sid,
      elementMuted: el.muted,
      elementPaused: el.paused,
    });
    if (enabled) {
      void el.play().then(
        () => {
          // eslint-disable-next-line no-console
          console.info("[screen-share-audio] watch-play-resolved", {
            trackSid: track.sid,
          });
        },
        (error: unknown) => {
          // eslint-disable-next-line no-console
          console.warn("[screen-share-audio] watch-play-rejected", {
            error,
            trackSid: track.sid,
          });
        },
      );
    }
  }, [track]);

  // The track is deliberately mounted in the call panel, including while the
  // share is still a tile, so it can be primed muted before the Watch click.
  return <audio ref={audioRef} autoPlay aria-hidden="true" />;
}

/** The expanded view of one shared screen. */
export function ScreenShareStage({
  share,
  name,
  onClose,
}: ScreenShareStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = videoRef.current;

    if (!el) return;

    share.track.attach(el);

    return () => {
      share.track.detach(el);
      // detach() alone leaves the last decoded frame painted; clearing the
      // source is what actually blanks it.
      el.srcObject = null;
    };
  }, [share.track]);

  // Tracks the real fullscreen state, not just our own toggle -- Esc or the
  // browser's own exit control leave document.fullscreenElement empty without
  // going through toggleFullscreen.
  useEffect(() => {
    const onChange = () => {
      const stage = stageRef.current;
      const active = document.fullscreenElement === stage;

      setIsFullscreen(active);
    };

    document.addEventListener("fullscreenchange", onChange);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // Watching a different share (or leaving the call) unmounts this stage
      // -- don't strand the browser in fullscreen on a now-detached element.
      if (document.fullscreenElement === stageRef.current) {
        void document.exitFullscreen().catch(() => {
          // The document may no longer be active during route/unmount cleanup.
        });
      }
    };
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      stageRef.current?.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div
      ref={stageRef}
      className="relative h-full min-h-0 w-full overflow-hidden rounded-medium bg-black"
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="block h-full min-h-0 w-full object-contain"
      />
      <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-tiny text-white">
        {name}
      </div>

      <div className="absolute right-3 top-3 flex gap-2">
        <Button
          isIconOnly
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
          className="bg-black/60 text-white"
          size="sm"
          onPress={toggleFullscreen}
        >
          <Icon name={isFullscreen ? "minimize" : "maximize"} size={16} />
        </Button>

        <Button className="bg-black/60 text-white" size="sm" onPress={onClose}>
          Stop watching
        </Button>
      </div>
    </div>
  );
}
