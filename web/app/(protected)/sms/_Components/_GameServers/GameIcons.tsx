"use client";

import { motion } from "framer-motion";
import { C } from "./palette";

function sp(x: number, y: number, r: number) {
  const s = r * 0.22;
  return `M${x},${y - r} L${x + s},${y - s} L${x + r},${y} L${x + s},${y + s} L${x},${y + r} L${x - s},${y + s} L${x - r},${y} L${x - s},${y - s}Z`;
}

export function Spark({ x, y, r, d = 0 }: { x: number; y: number; r: number; d?: number }) {
  return (
    <motion.g
      animate={{ opacity: [0.9, 0.05, 0.9] }}
      transition={{ duration: 2.5, repeat: Infinity, delay: d, ease: "easeInOut" }}
    >
      <path d={sp(x, y, r)} fill={C.w} />
    </motion.g>
  );
}

export function MinecraftIcon({ size = 56 }: { size?: number }) {
  const D = "#0C0D10";
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <defs>
        <filter id="mc-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={C.red} floodOpacity="0.55" />
        </filter>
      </defs>
      <g filter="url(#mc-drop)">
        <polygon points="28,6 52,18 28,30 4,18" fill={C.gi} />
        <polygon points="10,16 16,13 24,17 18,20" fill={C.w} fillOpacity="0.14" />
        <polygon points="30,9 36,12 30,15 24,12" fill={C.w} fillOpacity="0.1" />
        <polygon points="4,18 28,30 28,52 4,40" fill={C.ga} />
        <rect x="6" y="24" width="7" height="7" rx="1" fill={D} fillOpacity="0.55" />
        <rect x="10" y="34" width="6" height="6" rx="1" fill={D} fillOpacity="0.55" />
        <rect x="6" y="42" width="7" height="6" rx="1" fill={D} fillOpacity="0.55" />
        <polygon points="28,30 52,18 52,40 28,52" fill={C.ga} fillOpacity="0.55" />
        <rect x="31" y="24" width="7" height="7" rx="1" fill={D} fillOpacity="0.45" />
        <rect x="40" y="18" width="6" height="6" rx="1" fill={D} fillOpacity="0.45" />
        <rect x="42" y="30" width="7" height="7" rx="1" fill={D} fillOpacity="0.45" />
      </g>
    </svg>
  );
}

export function CS2Icon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <defs>
        <filter id="cs-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={C.red} floodOpacity="0.7" />
        </filter>
      </defs>
      <g filter="url(#cs-drop)">
        <circle cx="28" cy="28" r="24" fill={C.redD} />
        <circle cx="28" cy="28" r="24" stroke={C.redM} strokeWidth="2" fill="none" />
        <circle cx="28" cy="28" r="20" stroke={C.red} strokeWidth="1" fill="none" strokeOpacity="0.5" />
        <path
          d="M28,12 L31.2,21.6 L41.6,21.6 L33.6,27.4 L36.4,37 L28,31.4 L19.6,37 L22.4,27.4 L14.4,21.6 L24.8,21.6 Z"
          fill={C.red}
        />
        <path d="M28,12 L31.2,21.6 L28,23.6 L24.8,21.6 Z" fill={C.w} fillOpacity="0.22" />
        <circle cx="28" cy="28" r="4.5" fill={C.redD} />
        <circle cx="28" cy="28" r="2" fill={C.redL} fillOpacity="0.7" />
      </g>
    </svg>
  );
}

export function AmongUsIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <defs>
        <filter id="au-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={C.red} floodOpacity="0.7" />
        </filter>
      </defs>
      <g filter="url(#au-drop)" transform="translate(9,4)">
        <path d="M5,38 Q0,38 0,26 L0,12 Q0,0 19,0 Q38,0 38,12 L38,26 Q38,38 33,38 Z" fill={C.red} />
        <path d="M6,5 Q19,0 32,5 L32,19 Q19,25 6,19 Z" fill={C.w} fillOpacity="0.28" />
        <rect x="33" y="8" width="11" height="16" rx="3.5" fill={C.redM} />
        <rect x="3" y="35" width="14" height="9" rx="3.5" fill={C.redD} />
        <rect x="21" y="35" width="14" height="9" rx="3.5" fill={C.redD} />
      </g>
    </svg>
  );
}

export function ValorantIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <defs>
        <linearGradient id="val-bg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={C.redM} />
          <stop offset="100%" stopColor={C.redD} />
        </linearGradient>
        <filter id="val-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={C.red} floodOpacity="0.6" />
        </filter>
      </defs>
      <g filter="url(#val-drop)">
        <rect x="2" y="2" width="52" height="52" rx="12" fill="url(#val-bg)" />
        <path d="M8,14 L28,42 L48,14 L40,14 L28,32 L16,14 Z" fill={C.w} fillOpacity="0.9" />
        <path d="M16,14 L28,32 L28,42 L20,28 Z" fill={C.w} fillOpacity="0.35" />
      </g>
    </svg>
  );
}

export function RustIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <defs>
        <linearGradient id="rust-bg" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3A1A0A" />
          <stop offset="100%" stopColor={C.redD} />
        </linearGradient>
        <filter id="rust-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={C.red} floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter="url(#rust-drop)">
        <rect x="2" y="2" width="52" height="52" rx="12" fill="url(#rust-bg)" />
        <circle cx="28" cy="28" r="16" stroke={C.redL} strokeWidth="2.5" fill="none" />
        <circle cx="28" cy="28" r="6" fill={C.redL} />
        <line x1="28" y1="8" x2="28" y2="14" stroke={C.gi} strokeWidth="3" strokeLinecap="round" />
        <line x1="28" y1="42" x2="28" y2="48" stroke={C.gi} strokeWidth="3" strokeLinecap="round" />
        <line x1="8" y1="28" x2="14" y2="28" stroke={C.gi} strokeWidth="3" strokeLinecap="round" />
        <line x1="42" y1="28" x2="48" y2="28" stroke={C.gi} strokeWidth="3" strokeLinecap="round" />
        <line x1="14" y1="14" x2="18" y2="18" stroke={C.ga} strokeWidth="2" strokeLinecap="round" />
        <line x1="38" y1="38" x2="42" y2="42" stroke={C.ga} strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="14" x2="38" y2="18" stroke={C.ga} strokeWidth="2" strokeLinecap="round" />
        <line x1="18" y1="38" x2="14" y2="42" stroke={C.ga} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function FloatingIcon({ children, delay = 0, dy = 7 }: { children: React.ReactNode; delay?: number; dy?: number }) {
  return (
    <motion.div
      animate={{ y: [0, -dy, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <motion.span
        animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: size + 4,
          height: size + 4,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <span style={{ width: size, height: size, borderRadius: "50%", backgroundColor: color, position: "relative" }} />
    </span>
  );
}
