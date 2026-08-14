"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtime } from "@/lib/useRealtime";

/**
 * How often we tell the server "still typing". One frame per keystroke would be
 * a request per character; this bounds it by wall-clock instead, so a fast
 * typist costs the same as a slow one.
 */
const THROTTLE_MS = 3000;

/**
 * How long a received TYPING event keeps someone in the indicator. Kept just
 * above THROTTLE_MS so each ping (3s) lands comfortably before the previous
 * one expires (4s) — the 1s margin absorbs network jitter, so the dots stay
 * steady while someone types continuously instead of flickering.
 *
 * There is no "stopped typing" event; this timer is what hides the indicator,
 * including if the sender simply vanishes.
 */
const EXPIRY_MS = 4000;

/**
 * Typing indicator state for one conversation.
 *
 * `typingIds`   — other members currently composing (never yourself).
 * `notifyTyping` — call on every keystroke; it throttles internally.
 */
export function useTyping(
  conversationId: string | null,
  myUserId: string | null,
) {
  const { subscribe, send } = useRealtime();
  const [typingIds, setTypingIds] = useState<string[]>([]);

  // One expiry timer per sender, reset on each new event from them.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastSentAt = useRef(0);

  const forget = useCallback((senderId: string) => {
    clearTimeout(timers.current.get(senderId));
    timers.current.delete(senderId);
    setTypingIds((prev) => prev.filter((id) => id !== senderId));
  }, []);

  // ── receive ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;

    const offTyping = subscribe("TYPING", (event) => {
      // The backend already skips the sender, but never trust that twice.
      if (event.senderId === myUserId) return;
      if (event.conversationId !== conversationId) return;

      setTypingIds((prev) =>
        prev.includes(event.senderId) ? prev : [...prev, event.senderId],
      );

      clearTimeout(timers.current.get(event.senderId));
      timers.current.set(
        event.senderId,
        setTimeout(() => forget(event.senderId), EXPIRY_MS),
      );
    });

    // Their message arriving IS the "stopped typing" signal we never send.
    const offMessage = subscribe("MESSAGE", (event) => {
      if (event.roomId === conversationId) forget(event.senderId);
    });

    return () => {
      offTyping();
      offMessage();
      // Switching conversations must not leak timers or carry indicators over.
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      setTypingIds([]);
    };
  }, [conversationId, myUserId, subscribe, forget]);

  // ── send (throttled, over the socket — not HTTP) ─────────────────────────
  const notifyTyping = useCallback(() => {
    if (!conversationId) return;

    const now = Date.now();

    if (now - lastSentAt.current < THROTTLE_MS) return;
    lastSentAt.current = now;

    send({ type: "TYPING", conversationId });
  }, [conversationId, send]);

  return { typingIds, notifyTyping };
}
