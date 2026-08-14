"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Cpu, Globe, Settings, Play, Square } from "lucide-react";
import { C } from "./palette";
import { MinecraftIcon, CS2Icon, AmongUsIcon, ValorantIcon, RustIcon, FloatingIcon, PulsingDot } from "./GameIcons";
import type { ServerData } from "./GameServersPage";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  minecraft: MinecraftIcon,
  cs2: CS2Icon,
  "among-us": AmongUsIcon,
  valorant: ValorantIcon,
  rust: RustIcon,
};

const STATUS_COLORS: Record<string, string> = {
  online: C.online,
  idle:   C.idle,
  offline:C.offline,
};

interface Props {
  server: ServerData;
  index: number;
  onSettings: () => void;
}

export default function ServerCard({ server, index, onSettings }: Props) {
  const [hov, setHov] = useState(false);
  const Icon = ICONS[server.game];
  const statusColor = STATUS_COLORS[server.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      style={{
        backgroundColor: C.surf,
        borderRadius: "14px",
        border: `1px solid ${hov ? C.redM : C.bd}`,
        boxShadow: hov
          ? `0 20px 48px ${C.redD}55, 0 0 0 1px ${C.redM}`
          : "0 2px 12px rgba(0,0,0,0.3)",
        transition: "border-color 0.2s, box-shadow 0.2s",
        overflow: "hidden",
        cursor: "default",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Top shimmer on hover */}
      <motion.div
        animate={{ opacity: hov ? 1 : 0 }}
        transition={{ duration: 0.22 }}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "2px",
          background: `linear-gradient(90deg, transparent, ${C.red}, transparent)`,
          pointerEvents: "none",
        }}
      />

      {/* Art area */}
      <div style={{
        height: "148px",
        background: `radial-gradient(ellipse at 50% 90%, ${C.redD}99 0%, ${C.bg} 70%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(circle at center, ${C.bd}55 1px, transparent 1px)`,
          backgroundSize: "14px 14px", opacity: 0.4,
        }} />

        {Icon && (
          <FloatingIcon delay={index * 0.3} dy={8}>
            <Icon size={72} />
          </FloatingIcon>
        )}

        {/* Status badge */}
        <div style={{
          position: "absolute", top: "10px", right: "10px",
          display: "flex", alignItems: "center", gap: "6px",
          backgroundColor: `${C.bg}CC`, border: `1px solid ${C.bd}`,
          borderRadius: "20px", padding: "4px 10px", backdropFilter: "blur(8px)",
        }}>
          <PulsingDot color={statusColor} size={7} />
          <span style={{ color: statusColor, fontSize: "11px", fontWeight: 600, textTransform: "capitalize" }}>
            {server.status}
          </span>
        </div>

        {/* Settings gear — top-left */}
        <motion.button
          whileHover={{ backgroundColor: `${C.bg}EE`, rotate: 45, scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={e => { e.stopPropagation(); onSettings(); }}
          style={{
            position: "absolute", top: "10px", left: "10px",
            backgroundColor: `${C.bg}AA`, border: `1px solid ${C.bd}`,
            borderRadius: "8px", padding: "5px",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(8px)",
            transition: "background-color 0.18s",
          }}
        >
          <Settings size={14} color={C.gi} />
        </motion.button>
      </div>

      {/* Info area */}
      <div style={{ padding: "15px 16px 14px" }}>
        <div style={{ marginBottom: "9px" }}>
          <h3 style={{ color: C.w, fontSize: "15px", fontWeight: 700, margin: "0 0 2px", letterSpacing: "-0.01em" }}>
            {server.name}
          </h3>
          <span style={{ color: C.red, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {server.game.replace(/-/g, " ")}
          </span>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "13px", flexWrap: "wrap" }}>
          {[
            { Icon: Users, val: `${server.players}/${server.maxPlayers}` },
            { Icon: Cpu,   val: `${server.cpu}% CPU` },
            { Icon: Globe, val: server.region },
          ].map(({ Icon: Ic, val }) => (
            <div key={val} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Ic size={12} color={C.ga} />
              <span style={{ color: C.gm, fontSize: "11px" }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Action button */}
        <motion.button
          whileHover={{ backgroundColor: server.status === "online" ? "#111A11" : C.redM }}
          whileTap={{ scale: 0.97 }}
          style={{
            width: "100%", padding: "9px",
            backgroundColor: server.status === "online" ? `${C.online}18` : C.red,
            border: `1px solid ${server.status === "online" ? C.online : C.redM}`,
            borderRadius: "8px", color: server.status === "online" ? C.online : C.w,
            fontSize: "13px", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
            transition: "background-color 0.18s", fontFamily: "inherit",
          }}
        >
          {server.status === "online"
            ? <><Square size={12} fill="currentColor" /> Stop server</>
            : <><Play size={12} fill="currentColor" /> Start server</>
          }
        </motion.button>
      </div>
    </motion.div>
  );
}

export function EmptyServerSlot({ onClick, onBuy, index, isFull }: {
  onClick: () => void;
  onBuy: () => void;
  index: number;
  isFull?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const action = isFull ? onBuy : onClick;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      onClick={action}
      style={{
        backgroundColor: C.surf, borderRadius: "14px",
        border: `1.5px dashed ${hov ? (isFull ? C.idle : C.redM) : C.bd}`,
        boxShadow: hov ? `0 12px 36px ${C.redD}33` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        cursor: "pointer", minHeight: "268px",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "12px",
      }}
    >
      <motion.div
        animate={{ scale: hov ? 1.12 : 1, rotate: hov && !isFull ? 90 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        style={{
          width: "52px", height: "52px", borderRadius: "12px",
          backgroundColor: hov ? (isFull ? `${C.idle}18` : `${C.red}22`) : C.bg,
          border: `1.5px dashed ${hov ? (isFull ? C.idle : C.redM) : C.ga}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background-color 0.18s, border-color 0.18s",
        }}
      >
        <span style={{ color: hov ? (isFull ? C.idle : C.red) : C.ga, fontSize: isFull ? "18px" : "24px", fontWeight: 300, lineHeight: 1 }}>
          {isFull ? "⚡" : "+"}
        </span>
      </motion.div>
      <div style={{ textAlign: "center" }}>
        <motion.p
          animate={{ color: hov ? C.gi : C.ga }}
          transition={{ duration: 0.18 }}
          style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 3px" }}
        >
          {isFull ? "Get more servers" : "Add a server"}
        </motion.p>
        {isFull && (
          <p style={{ color: C.ga, fontSize: "11px", margin: 0 }}>Upgrade your plan</p>
        )}
      </div>
    </motion.div>
  );
}
