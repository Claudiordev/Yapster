"use client";

import { ReactNode, useEffect, useRef } from "react";

interface VoiceRingProps {
  analyser: AnalyserNode | null;
  children: ReactNode;
}

const RING_STYLE: React.CSSProperties = {
  transformOrigin: "center",
  transform: "scale(1)",
  opacity: 0.12,
  transition: "transform 90ms ease-out, opacity 130ms ease-out",
};

/**
 * Wraps an avatar and renders concentric rings around it that pulse outward
 * with the live microphone amplitude — a circular "speaking" indicator.
 */
export function VoiceRing({ analyser, children }: VoiceRingProps) {
  const ringsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!analyser || !ringsRef.current) return;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const rings = Array.from(ringsRef.current.children) as HTMLElement[];
    let rafId = 0;

    function tick() {
      analyser!.getByteFrequencyData(data);

      let sum = 0;

      for (let i = 0; i < data.length; i++) sum += data[i];
      const amp = Math.min(1, (sum / data.length / 255) * 1.8);

      // rings[0] is the outermost (rendered first / furthest back)
      rings.forEach((el, i) => {
        const depth = rings.length - 1 - i;
        const scale = 1 + amp * (0.25 + depth * 0.22);

        el.style.transform = `scale(${scale.toFixed(3)})`;
        el.style.opacity = Math.max(0.08, amp - depth * 0.18).toFixed(3);
      });

      rafId = requestAnimationFrame(tick);
    }

    tick();

    return () => cancelAnimationFrame(rafId);
  }, [analyser]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <div ref={ringsRef} aria-hidden className="pointer-events-none absolute inset-0">
        <span
          className="absolute inset-0 rounded-full bg-brand/20"
          style={RING_STYLE}
        />
        <span
          className="absolute inset-0 rounded-full bg-brand/25"
          style={RING_STYLE}
        />
        <span
          className="absolute inset-0 rounded-full ring-2 ring-brand/60"
          style={RING_STYLE}
        />
      </div>
      {children}
    </div>
  );
}
