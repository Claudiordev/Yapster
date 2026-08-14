"use client";

import type { UserStatus } from "@/lib/chat";

interface StatusDotProps {
  /** Absent or unknown renders as offline. */
  status?: UserStatus;
  /** Used for the accessible label, e.g. "Alice is online". */
  name?: string;
  className?: string;
}

/**
 * Presence badge for an avatar. The ring matches the list background so the
 * dot reads as cut out of the avatar rather than floating on top of it.
 */
const STYLES: Record<UserStatus, { dot: string; label: string }> = {
  online: { dot: "bg-success", label: "online" },
  busy: { dot: "bg-danger", label: "busy" },
  idle: { dot: "bg-warning", label: "idle" },
  offline: { dot: "bg-default-300", label: "offline" },
};

export function StatusDot({ status, name, className = "" }: StatusDotProps) {
  const { dot, label } = STYLES[status ?? "offline"];

  return (
    <span
      aria-label={name ? `${name} is ${label}` : label}
      className={`block h-3 w-3 rounded-full ring-2 ring-content1 ${dot} ${className}`}
      role="img"
      title={label}
    />
  );
}
