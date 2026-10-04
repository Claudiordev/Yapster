"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Button } from "@heroui/button";
import { RemoteAudioTrack } from "livekit-client";

import type { ScreenShare } from "@/types/call";
import { ScreenShareVolumeMenu } from "./ScreenShareVolumeMenu";

import { Icon } from "@/components/Icon/Icon";

interface ScreenShareTileProps {
  share: ScreenShare;
  /** Display name of whoever is sharing. */
  name: string;
  onWatch: () => void;
  /** Narrower 4:3 variant for the strip next to a watched screen. */
  compact?: boolean;
}

/**
 * A screen someone is sharing, shown as a tile in the participants grid with a
 * play button. Nothing is decoded until it's actually watched, so a call with
 * several sharers doesn't pay for every stream at once.
 */
export function ScreenShareTile({
  name,
  onWatch,
  compact = false,
}: ScreenShareTileProps) {
  const label = name === "You" ? "You are sharing" : `${name} is sharing`;

  return (
    <button
      aria-label={`Watch ${name === "You" ? "your" : `${name}'s`} screen`}
      className={`group relative w-full min-w-0 overflow-hidden rounded-large border border-brand/50 bg-content2 text-left shadow-[0_0_0_1px_rgba(255,63,82,0.13),0_10px_30px_rgba(0,0,0,0.3)] outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        compact ? "aspect-[4/3] flex-shrink-0" : "h-full min-h-0"
      }`}
      type="button"
      onClick={onWatch}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,63,82,0.22),transparent_55%)]"
      />

      <span className={`absolute inset-0 grid place-items-center ${compact ? "pb-5" : ""}`}>
        <span
          className={`grid place-items-center rounded-full bg-brand text-white shadow-lg transition-transform group-hover:scale-110 group-active:scale-95 ${
            compact ? "h-9 w-9" : "h-12 w-12"
          }`}
        >
          <svg
            aria-hidden
            className={`translate-x-px ${compact ? "h-4 w-4" : "h-5 w-5"}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>

      <span className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-small border border-white/10 bg-black/70 px-2 py-1 text-tiny font-bold text-white backdrop-blur-sm">
        <i className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success" />
        <span className="truncate">{label}</span>
      </span>
    </button>
  );
}

interface ScreenShareStageProps {
  share: ScreenShare;
  name: string;
  volume: number;
  canAdjustVolume: boolean;
  onVolumeChange: (volume: number) => void;
  onClose: () => void;
}

interface ScreenShareAudioProps {
  enabled: boolean;
  track?: ScreenShare["audioTrack"];
  volume: number;
}

/** Keeps display audio attached before the Watch click so autoplay is unlocked. */
export function ScreenShareAudio({
  enabled,
  track,
  volume,
}: ScreenShareAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  enabledRef.current = enabled;
  volumeRef.current = volume;

  useEffect(() => {
    const el = audioRef.current;

    if (!el || !track) return;

    el.autoplay = true;
    track.attach(el);

    if (track instanceof RemoteAudioTrack) {
      // LiveKit's Web Audio gain supports 0–200%; keep the media element muted
      // so it does not play a second, unamplified copy of the same track.
      el.muted = true;
      track.setVolume(enabledRef.current ? volumeRef.current / 100 : 0);
    } else {
      // Your own share's audio is never played back to you: it is already coming out
      // of your speakers, so hearing it again is an echo (and can feed back into the share).
      el.muted = true;
    }

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
          enabled: enabledRef.current,
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
  }, [track]);

  useEffect(() => {
    const el = audioRef.current;

    if (!el || !track) return;

    if (track instanceof RemoteAudioTrack) {
      el.muted = true;
      track.setVolume(enabled ? volume / 100 : 0);
    } else {
      // Local track (you are the sharer): see the note above, never audible.
      el.muted = true;

      return;
    }
    // eslint-disable-next-line no-console
    console.info("[screen-share-audio] watch-state-changed", {
      enabled,
      volume,
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
  }, [enabled, track, volume]);

  // The track is deliberately mounted in the call panel, including while the
  // share is still a tile, so it can be primed muted before the Watch click.
  return <audio ref={audioRef} autoPlay aria-hidden="true" />;
}

/** The expanded view of one shared screen. */
export function ScreenShareStage({
  share,
  name,
  volume,
  canAdjustVolume,
  onVolumeChange,
  onClose,
}: ScreenShareStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volumeMenu, setVolumeMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  function openVolumeMenu(x: number, y: number) {
    if (!canAdjustVolume || !share.audioTrack) return;
    setVolumeMenu({ x, y });
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    openVolumeMenu(event.clientX, event.clientY);
  }

  function handleContextMenuKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ContextMenu" &&
      !(event.shiftKey && event.key === "F10")
    ) {
      return;
    }

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();

    openVolumeMenu(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    );
  }

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
      aria-label={canAdjustVolume ? `${name} shared screen options` : undefined}
      aria-haspopup={canAdjustVolume ? "dialog" : undefined}
      className="relative h-full min-h-0 w-full overflow-hidden rounded-large border border-brand/50 bg-black shadow-[0_0_0_1px_rgba(255,63,82,0.13),0_10px_30px_rgba(0,0,0,0.3)]"
      role={canAdjustVolume ? "button" : undefined}
      tabIndex={canAdjustVolume ? 0 : undefined}
      onContextMenu={handleContextMenu}
      onKeyDown={canAdjustVolume ? handleContextMenuKey : undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="block h-full min-h-0 w-full object-contain"
      />
      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-small border border-white/10 bg-black/70 px-2 py-1 text-tiny font-bold text-white backdrop-blur-sm">
        <i className="h-1.5 w-1.5 rounded-full bg-success" />
        {name === "You" ? "You are sharing" : `${name} is sharing`}
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

      {canAdjustVolume && volumeMenu && share.audioTrack && (
        <ScreenShareVolumeMenu
          name={name}
          volume={volume}
          x={volumeMenu.x}
          y={volumeMenu.y}
          onChange={onVolumeChange}
          onClose={() => setVolumeMenu(null)}
        />
      )}
    </div>
  );
}
