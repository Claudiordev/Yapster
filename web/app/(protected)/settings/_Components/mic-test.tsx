"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";

const BAR_COUNT = 24;

/**
 * Live microphone meter: requests the mic, runs the signal through a Web Audio
 * AnalyserNode and animates a row of bars from the frequency data. Needs a
 * secure context (HTTPS/localhost) — getUserMedia is undefined over plain HTTP.
 */
export function MicTest({ deviceId }: { deviceId: string }) {
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  function resetBars() {
    barsRef.current.forEach((el) => {
      if (el) el.style.height = "8%";
    });
  }

  function stop() {
    cleanupRef.current?.();
    cleanupRef.current = undefined;
    setTesting(false);
    resetBars();
  }

  async function start() {
    setError(null);

    const md =
      typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;

    if (!md?.getUserMedia) {
      setError("Microphone access needs a secure (HTTPS) connection.");

      return;
    }

    try {
      const stream = await md.getUserMedia({
        audio:
          deviceId && deviceId !== "default"
            ? { deviceId: { exact: deviceId } }
            : true,
      });
      const ctx = new AudioContext();

      if (ctx.state === "suspended") await ctx.resume();

      const analyser = ctx.createAnalyser();

      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = barsRef.current;

        for (let i = 0; i < bars.length; i++) {
          const el = bars[i];

          if (el) el.style.height = `${Math.max(8, (data[i] / 255) * 100)}%`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      tick();

      cleanupRef.current = () => {
        cancelAnimationFrame(rafRef.current);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
      };
      setTesting(true);
    } catch {
      setError("Couldn't access the microphone.");
    }
  }

  useEffect(() => () => cleanupRef.current?.(), []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mic test</h2>
          <p className="text-tiny text-default-500">
            Speak to see your microphone level.
          </p>
        </div>
        <Button
          className={testing ? "" : "bg-brand text-white hover:bg-brand-hover"}
          size="sm"
          variant={testing ? "flat" : "solid"}
          onPress={testing ? stop : start}
        >
          {testing ? "Stop" : "Test"}
        </Button>
      </div>

      <div className="flex h-20 items-end gap-1 rounded-medium bg-content2 p-3">
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="flex-1 rounded-full bg-brand"
            style={{ height: "8%" }}
          />
        ))}
      </div>

      {error && <p className="text-tiny text-danger">{error}</p>}
    </div>
  );
}
