"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtime } from "@/lib/useRealtime";
import type { SelectableStatus } from "@/lib/chat";

/**
 * No mouse/keyboard/scroll for this long → auto-idle. Discord uses ~10 min and
 * Slack ~30; anything much shorter and people look idle while reading, which
 * trains everyone to ignore the dot. Switching tabs is handled separately and
 * instantly, so this only covers "sat at the desk doing nothing".
 */
const IDLE_AFTER_MS = 5 * 60_000;

/** How often we check the inactivity clock. Idle lands within one tick of the limit. */
const CHECK_EVERY_MS = 15_000;

const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;

/**
 * The current user's own status: a manual choice, with automatic idle layered
 * on top of it.
 *
 *   manual ONLINE + inactive  → IDLE   (auto)
 *   manual ONLINE + active    → ONLINE
 *   manual BUSY               → BUSY   — a deliberate choice always wins
 *   manual IDLE               → IDLE   — pinned until they pick something else
 *
 * The server keeps this in memory next to the socket (not persisted), so the
 * effect below re-announces on every reconnect — otherwise a wifi blip silently
 * resets you to ONLINE on everyone else's list.
 */
export function useMyStatus() {
  const { send, status: connection } = useRealtime();
  const [manual, setManual] = useState<SelectableStatus>("ONLINE");
  const [isIdle, setIsIdle] = useState(false);

  const effective: SelectableStatus =
    manual === "ONLINE" && isIdle ? "IDLE" : manual;

  // ── auto-idle detection ─────────────────────────────────────────────────
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now();
      setIsIdle(false); // React bails out when already false — no re-render
    };

    ACTIVITY_EVENTS.forEach((e) =>
      document.addEventListener(e, bump, { passive: true }),
    );

    // A hidden tab is a definite signal, and it fires BEFORE the browser starts
    // throttling timers or freezing the page — so it's the reliable one.
    const onVisibility = () =>
      document.visibilityState === "hidden" ? setIsIdle(true) : bump();

    document.addEventListener("visibilitychange", onVisibility);

    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_AFTER_MS) setIsIdle(true);
    }, CHECK_EVERY_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, []);

  // ── announce ────────────────────────────────────────────────────────────
  // Covers BOTH cases in one effect: the status changed, or the socket came
  // back. The server ignores a repeat of the same value, so extra sends are
  // free.
  useEffect(() => {
    if (connection === "open") {
      send({ type: "USER_STATUS_EVENT", userStatusType: effective });
    }
  }, [effective, connection, send]);

  const choose = useCallback((next: SelectableStatus) => {
    setManual(next);
    if (next !== "ONLINE") setIsIdle(false); // picking BUSY/IDLE clears auto-idle
  }, []);

  return { myStatus: effective, choose, isConnected: connection === "open" };
}
