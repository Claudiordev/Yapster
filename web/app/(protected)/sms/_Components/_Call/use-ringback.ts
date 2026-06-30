"use client";

import { useEffect } from "react";
import { useSound } from "react-sounds";

import { useAudioSettings } from "@/lib/use-audio-settings";

const RING_SOUND = "notification/notification";
const BEEP_GAP_MS = 400; // spacing between the two beeps of a "ring-ring"
const PAUSE_MS = 1000; // silence after the double, before it repeats

/**
 * Rings while `active` is true: plays the notification sound twice, pauses ~1s,
 * then repeats — until the call connects or is cancelled. Uses react-sounds.
 */
export function useRingback(active: boolean) {
  const { play } = useSound(RING_SOUND);
  // Ringback plays through the speaker, so it honors the global output volume.
  const { outputVolume } = useAudioSettings();

  useEffect(() => {
    if (!active) return;

    const volume = Math.min(100, Math.max(0, outputVolume)) / 100;
    let cancelled = false;
    let secondBeep: ReturnType<typeof setTimeout>;

    const ringTwice = () => {
      if (cancelled) return;
      play({ volume });
      secondBeep = setTimeout(() => {
        if (!cancelled) play({ volume });
      }, BEEP_GAP_MS);
    };

    ringTwice(); // first ring-ring immediately
    const interval = setInterval(ringTwice, BEEP_GAP_MS + PAUSE_MS);

    return () => {
      cancelled = true;
      clearTimeout(secondBeep);
      clearInterval(interval);
    };
  }, [active, play, outputVolume]);
}
