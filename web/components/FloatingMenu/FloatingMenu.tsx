"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface FloatingMenuProps {
  /** Screen position the menu opens at (e.g. the right-click point). */
  x: number;
  y: number;
  /** Menu size in px, used to keep it inside the viewport. */
  width: number;
  height: number;
  label: string;
  role?: "menu" | "dialog";
  /** Extra classes for width and padding, e.g. `w-60 p-3`. */
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

const EDGE_GAP = 8;

/**
 * A menu portalled to <body> at a screen position: clamped inside the viewport
 * and closed on outside press, Escape, resize or window blur. The shared shell
 * behind the message, participant-volume and screen-share-volume menus.
 */
export function FloatingMenu({
  x,
  y,
  width,
  height,
  label,
  role = "dialog",
  className = "",
  onClose,
  children,
}: FloatingMenuProps) {
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

  const left = Math.max(EDGE_GAP, Math.min(x, window.innerWidth - width - EDGE_GAP));
  const top = Math.max(EDGE_GAP, Math.min(y, window.innerHeight - height - EDGE_GAP));

  return createPortal(
    <div
      ref={menuRef}
      aria-label={label}
      className={`fixed z-[100] rounded-medium border border-divider bg-content1 shadow-large ${className}`}
      role={role}
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}
