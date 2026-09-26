"use client";

import { useEffect, useState } from "react";

const POLL_MS = 5_000;

const GOOD_MS = 80;
const OK_MS = 150;

type Quality = "good" | "ok" | "poor" | "unknown";

/** Filled bars per quality (out of 3) and the color they are drawn in. */
const BARS: Record<Quality, { filled: number; color: string }> = {
  good: { filled: 3, color: "bg-success" },
  ok: { filled: 2, color: "bg-warning" },
  poor: { filled: 1, color: "bg-danger" },
  unknown: { filled: 0, color: "bg-default-300" },
};

/** Heights of the three bars, shortest to tallest (px). */
const BAR_HEIGHTS = [6, 10, 14];

function qualityOf(ms: number | null): Quality {
  if (ms === null) return "unknown";
  if (ms <= GOOD_MS) return "good";
  if (ms <= OK_MS) return "ok";

  return "poor";
}

/**
 * Round signal-strength badge for the signed-in user only (nothing about it is
 * shared), shown in the call header while connected. It shows three bars, no
 * number: all three green is good, two yellow is okay, one red is poor, and
 * none filled means unavailable. The exact milliseconds show on hover.
 * Every 5 s it times a GET to the voice service's ping through the app's own
 * path, so the number is the real round trip this user gets. The next probe is
 * scheduled after the previous one finishes (never overlapping), and probing
 * pauses while the tab is hidden.
 */
export function LatencyIndicator({ onPress }: { onPress?: () => void }) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let stopped = false;

    const schedule = () => {
      if (!stopped) timer = setTimeout(measure, POLL_MS);
    };

    async function measure() {
      if (document.visibilityState === "hidden") {
        schedule();

        return;
      }

      controller = new AbortController();

      const started = performance.now();

      try {
        const res = await fetch("/api/voice/ping", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`ping ${res.status}`);
        await res.arrayBuffer();
        if (!stopped) setMs(Math.max(1, Math.round(performance.now() - started)));
      } catch {
        if (!stopped && !controller.signal.aborted) setMs(null);
      }

      schedule();
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      controller?.abort();
      void measure();
    };

    void measure();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const quality = qualityOf(ms);
  const { filled, color } = BARS[quality];
  const label = ms === null ? "Latency unavailable" : `Latency ${ms} ms`;

  const bars = (
    <span className="flex h-[14px] items-end gap-[3px]">
      {BAR_HEIGHTS.map((height, i) => (
        <span
          key={height}
          className={`w-[3px] rounded-full ${i < filled ? color : "bg-default-300/50"}`}
          style={{ height }}
        />
      ))}
    </span>
  );
  const shape =
    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border-2 border-default-300/60 bg-content1 shadow-sm";

  // Not clickable unless a handler is given (server switching is off for now).
  if (!onPress) {
    return (
      <div aria-label={label} className={shape} role="status" title={label}>
        {bars}
      </div>
    );
  }

  return (
    <button
      aria-label={`${label}. Change call server`}
      className={`${shape} outline-none transition-colors hover:border-default-400 focus-visible:ring-2 focus-visible:ring-brand`}
      title={`${label} · click to change server`}
      type="button"
      onClick={onPress}
    >
      {bars}
    </button>
  );
}
