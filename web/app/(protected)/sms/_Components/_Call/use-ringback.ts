"use client";

import { useEffect } from "react";
import { useSound } from "react-sounds";

const RING_SOUND = "notification/notification";
const BEEP_GAP_MS = 400; // spacing between the two beeps of a "ring-ring"
const PAUSE_MS = 1000; // silence after the double, before it repeats

/**
 * Rings while `active` is true: plays the notification sound twice, pauses ~1s,
 * then repeats — until the call connects or is cancelled. Uses react-sounds.
 */
export function useRingback(active: boolean) {
  const { play } = useSound(RING_SOUND);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let secondBeep: ReturnType<typeof setTimeout>;

    const ringTwice = () => {
      if (cancelled) return;
      play();
      secondBeep = setTimeout(() => {
        if (!cancelled) play();
      }, BEEP_GAP_MS);
    };

    ringTwice(); // first ring-ring immediately
    const interval = setInterval(ringTwice, BEEP_GAP_MS + PAUSE_MS);

    return () => {
      cancelled = true;
      clearTimeout(secondBeep);
      clearInterval(interval);
    };
  }, [active, play]);
}
