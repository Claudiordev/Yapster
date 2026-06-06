"use client";

import { useEffect, useRef } from "react";

interface VoiceWaveLiveProps {
  analyser: AnalyserNode | null;
  bars?: number;
}

export function VoiceWaveLive({ analyser, bars = 10 }: VoiceWaveLiveProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analyser || !containerRef.current) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const barEls = Array.from(containerRef.current.children) as HTMLElement[];
    const binsPerBar = Math.max(1, Math.floor(data.length / bars));
    let rafId = 0;

    function tick() {
      analyser!.getByteFrequencyData(data);

      for (let i = 0; i < bars; i++) {
        let sum = 0;

        for (let j = 0; j < binsPerBar; j++) {
          sum += data[i * binsPerBar + j] ?? 0;
        }
        const avg = sum / binsPerBar / 255;
        const scale = Math.max(0.15, Math.min(1, avg * 1.4));
        const el = barEls[i];

        if (el) el.style.transform = `scaleY(${scale.toFixed(3)})`;
      }

      rafId = requestAnimationFrame(tick);
    }

    tick();

    return () => cancelAnimationFrame(rafId);
  }, [analyser, bars]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="flex items-center justify-center gap-1 h-10 mt-1"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-1 h-full rounded-full bg-gradient-to-b from-red-400 to-red-600"
          style={{
            transform: "scaleY(0.15)",
            transformOrigin: "center",
            transition: "transform 80ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
