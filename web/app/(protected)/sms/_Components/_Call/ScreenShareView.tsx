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

/** The expanded view of one shared screen. */
export function ScreenShareStage({ share, name, onClose }: ScreenShareStageProps) {
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
  }, [share]);

  // Tracks the real fullscreen state, not just our own toggle -- Esc or the
  // browser's own exit control leave document.fullscreenElement empty without
  // going through toggleFullscreen.
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === stageRef.current);

    document.addEventListener("fullscreenchange", onChange);

    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // Watching a different share (or leaving the call) unmounts this stage
      // -- don't strand the browser in fullscreen on a now-detached element.
      if (document.fullscreenElement === stageRef.current) {
        document.exitFullscreen();
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
      className="relative w-full overflow-hidden rounded-medium bg-black"
    >
      {/* Video-only track — any shared audio arrives as its own audio track
          and is already played by the call's audio handling. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className={isFullscreen ? "h-full w-full object-contain" : "max-h-[60vh] w-full object-contain"}
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
