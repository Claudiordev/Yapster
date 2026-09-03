"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@heroui/button";

import { Icon } from "@/components/icon";

interface ParticipantVolumeMenuProps {
  name: string;
  volume: number;
  showLocalControls: boolean;
  x: number;
  y: number;
  onChange: (volume: number) => void;
  onToggleMute: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const EDGE_GAP = 8;

export function ParticipantVolumeMenu({
  name,
  volume,
  showLocalControls,
  x,
  y,
  onChange,
  onToggleMute,
  onClose,
}: ParticipantVolumeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("pointerdown", closeOnOutsidePress);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePress);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const left = Math.max(
    EDGE_GAP,
    Math.min(x, window.innerWidth - MENU_WIDTH - EDGE_GAP),
  );
  const top = Math.max(
    EDGE_GAP,
    Math.min(y, window.innerHeight - 156 - EDGE_GAP),
  );

  return createPortal(
    <div
      ref={menuRef}
      aria-label={`Call controls for ${name}`}
      className="fixed z-[100] w-60 rounded-medium border border-divider bg-content1 p-3 shadow-large"
      role="dialog"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          {showLocalControls && (
            <p className="text-tiny text-default-500">Voice volume</p>
          )}
        </div>
        {showLocalControls && (
          <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {volume}%
          </span>
        )}
      </div>
      {showLocalControls && (
        <>
          <input
            aria-label={`${name} volume`}
            className="volume-bar w-full"
            max={200}
            min={0}
            step={1}
            type="range"
            value={volume}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <Button
            aria-label={volume === 0 ? `Unmute ${name}` : `Mute ${name}`}
            className="mt-3 w-full"
            color={volume === 0 ? "danger" : "default"}
            size="sm"
            startContent={
              <Icon name={volume === 0 ? "mic-off" : "mic"} size={14} />
            }
            variant="flat"
            onPress={onToggleMute}
          >
            {volume === 0 ? "Muted" : "Unmuted"}
          </Button>
        </>
      )}
    </div>,
    document.body,
  );
}
