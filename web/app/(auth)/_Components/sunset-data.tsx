import { ReactNode } from "react";

export type CloudShape = "a" | "b" | "c";

// Three silhouette cloud shapes with their own proportions.
export const SHAPES: Record<
  CloudShape,
  { vw: number; vh: number; body: ReactNode }
> = {
  // balanced cumulus
  a: {
    vw: 230,
    vh: 90,
    body: (
      <>
        <ellipse cx="50" cy="60" rx="30" ry="24" />
        <ellipse cx="96" cy="42" rx="40" ry="36" />
        <ellipse cx="146" cy="48" rx="36" ry="32" />
        <ellipse cx="190" cy="62" rx="28" ry="23" />
        <rect height="26" rx="13" width="192" x="22" y="58" />
      </>
    ),
  },
  // compact, taller puff
  b: {
    vw: 170,
    vh: 104,
    body: (
      <>
        <ellipse cx="58" cy="58" rx="34" ry="30" />
        <ellipse cx="104" cy="46" rx="40" ry="38" />
        <ellipse cx="132" cy="66" rx="28" ry="26" />
        <rect height="30" rx="15" width="116" x="28" y="62" />
      </>
    ),
  },
  // long, flat, many small bumps
  c: {
    vw: 320,
    vh: 82,
    body: (
      <>
        <ellipse cx="44" cy="54" rx="28" ry="22" />
        <ellipse cx="92" cy="44" rx="34" ry="30" />
        <ellipse cx="146" cy="40" rx="36" ry="32" />
        <ellipse cx="200" cy="46" rx="32" ry="28" />
        <ellipse cx="250" cy="52" rx="30" ry="24" />
        <ellipse cx="288" cy="58" rx="22" ry="20" />
        <rect height="24" rx="12" width="280" x="22" y="54" />
      </>
    ),
  },
};

export interface CloudSpec {
  left: string;
  bottom: string;
  width: number;
  opacity: number;
  shape: CloudShape;
  flip?: boolean;
  drift?: number; // drift animation duration in seconds (omit = static)
}

// Grey silhouette clouds around the horizon — mixed shapes, sizes, opacity
// (depth), some flipped, some slowly drifting.
export const CLOUDS: CloudSpec[] = [
  { left: "2%", bottom: "22%", width: 175, opacity: 0.95, shape: "a", drift: 26 },
  { left: "52%", bottom: "30%", width: 235, opacity: 0.9, shape: "c", flip: true, drift: 34 },
  { left: "78%", bottom: "15%", width: 150, opacity: 0.85, shape: "b", drift: 22 },
  { left: "18%", bottom: "46%", width: 88, opacity: 0.45, shape: "c", drift: 38 },
  { left: "88%", bottom: "40%", width: 80, opacity: 0.5, shape: "b", flip: true, drift: 32 },
];

export interface StarSpec {
  top: string;
  left: string;
  size: number;
  delay: string;
  duration: string;
}

// Stars scattered across the dark upper sky.
export const STARS: StarSpec[] = [
  { top: "5%", left: "9%", size: 3, delay: "0s", duration: "2.4s" },
  { top: "8%", left: "24%", size: 2, delay: "1.1s", duration: "3.1s" },
  { top: "4%", left: "41%", size: 2, delay: "0.5s", duration: "2.8s" },
  { top: "11%", left: "58%", size: 3, delay: "1.6s", duration: "2.6s" },
  { top: "6%", left: "73%", size: 2, delay: "0.9s", duration: "3.3s" },
  { top: "9%", left: "88%", size: 3, delay: "2.0s", duration: "2.5s" },
  { top: "17%", left: "16%", size: 2, delay: "1.4s", duration: "3.0s" },
  { top: "20%", left: "37%", size: 2, delay: "0.3s", duration: "2.7s" },
  { top: "15%", left: "52%", size: 3, delay: "2.2s", duration: "2.9s" },
  { top: "22%", left: "67%", size: 2, delay: "0.7s", duration: "3.2s" },
  { top: "18%", left: "82%", size: 2, delay: "1.9s", duration: "2.6s" },
  { top: "28%", left: "12%", size: 2, delay: "1.0s", duration: "3.1s" },
  { top: "30%", left: "46%", size: 2, delay: "2.4s", duration: "2.5s" },
  { top: "27%", left: "78%", size: 2, delay: "0.6s", duration: "2.8s" },
];

// Vertical sunset gradient: shadowed menu-grey at the top → warm, sun-lit
// cream at the bottom edge, with a wine midtone (our palette).
const CLOUD_GRADIENT_STOPS = (
  <>
    <stop offset="0%" stopColor="#2b2d31" />
    <stop offset="52%" stopColor="#8f4f59" />
    <stop offset="100%" stopColor="#ffd2a0" />
  </>
);

export function Cloud({
  shape,
  width,
  id,
}: {
  shape: CloudShape;
  width: number;
  id: string;
}) {
  const { vw, vh, body } = SHAPES[shape];

  return (
    <svg
      aria-hidden
      height={(width * vh) / vw}
      style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.28))" }}
      viewBox={`0 0 ${vw} ${vh}`}
      width={width}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          {CLOUD_GRADIENT_STOPS}
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>{body}</g>
    </svg>
  );
}
