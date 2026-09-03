"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ScreenShareVolumeMenuProps {
  name: string;
  volume: number;
  x: number;
  y: number;
  onChange: (volume: number) => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_HEIGHT = 100;
const EDGE_GAP = 8;

export function ScreenShareVolumeMenu({
  name,
  volume,
  x,
  y,
  onChange,
  onClose,
}: ScreenShareVolumeMenuProps) {
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
    Math.min(y, window.innerHeight - MENU_HEIGHT - EDGE_GAP),
  );

  return createPortal(
    <div
      ref={menuRef}
      aria-label={`Screen share volume for ${name}`}
      className="fixed z-[100] w-60 rounded-medium border border-divider bg-content1 p-3 shadow-large"
      role="dialog"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="text-tiny text-default-500">Screen share volume</p>
        </div>
        <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-foreground">
          {volume}%
        </span>
      </div>
      <input
        aria-label={`${name} screen share volume`}
        className="volume-bar w-full"
        max={200}
        min={0}
        step={1}
        type="range"
        value={volume}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>,
    document.body,
  );
}
