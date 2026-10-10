"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { C } from "@/app/(protected)/message/_Components/_GameServers/utils/palette";
import { MinecraftIcon, AmongUsIcon, ValorantIcon, RustIcon } from "../_GameServers/GameIcons";
import type { EventData } from "./EventsPage";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  minecraft: MinecraftIcon,
  "among-us": AmongUsIcon,
  valorant: ValorantIcon,
  rust: RustIcon,
};

// Colors lifted straight from the showcase's card design (styles/globals.css:
// --gold, --green, --brand, --brand-dark, --wine) so the row matches it exactly.
const GOLD = "#ffca56";
const GREEN = "#61d98b";
const BRAND = "#ff3f52";
const BRAND_DARK = "#8c1023";
const WINE = "#530b18";
const PURPLE = "#8b5cf6";
const PURPLE_HOVER = "#a074ff";
const PURPLE_BORDER = "#5b3fa0";
const PURPLE_DARK = "#4c2889";
const BRAND_HOVER = "#ff5c6d";
const JOINED_HOVER = "#3aa267";

function formatCountdown(ms: number) {
  if (ms <= 0) return "Live now";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

interface Props {
  event: EventData;
  index: number;
  onJoin: () => void;
  onDonate: () => void;
  onWatch: () => void;
}

export default function EventRow({ event, onJoin, onDonate, onWatch }: Props) {
  const [now, setNow] = useState(() => Date.now());

  // Drives the "starts in" timer so the row keeps ticking down live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const Icon = ICONS[event.game];
  const remaining = event.startsAt - now;
  const isLive = remaining <= 0;

  return (
    <article
      style={{
        border: `2px solid ${C.bd}`,
        borderRadius: "14px",
        background: "rgba(43, 45, 49, 0.96)",
        boxShadow: "0 5px 0 #1e1f22, 0 18px 44px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.035)",
        padding: "14px 18px",
      }}
    >
      {/* Topline: icon, event title, status pill */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            display: "grid",
            flex: "0 0 auto",
            width: "40px",
            height: "40px",
            placeItems: "center",
            border: `1px solid ${C.bd}`,
            borderRadius: "10px",
            background: C.bg,
          }}
        >
          {Icon ? (
            <Icon size={30} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" height={30} src={`/images/games/${event.game}.png`} width={30} />
          )}
        </span>

        <span style={{ display: "flex", minWidth: 0, flexDirection: "column" }}>
          <small style={{ color: "#85878d", fontSize: "10px", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {event.game.replace(/-/g, " ")}
          </small>
          <strong style={{ marginTop: "2px", color: "#fff", fontSize: "15px" }}>{event.name}</strong>
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            marginLeft: "auto",
            padding: "5px 10px",
            border: `1px solid ${isLive ? "rgba(97, 217, 139, 0.25)" : "rgba(97, 217, 139, 0.25)"}`,
            borderRadius: "999px",
            background: "rgba(97, 217, 139, 0.08)",
            color: GREEN,
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <i style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN, boxShadow: `0 0 7px ${GREEN}99` }} />
          {isLive ? "Live" : "Open"}
        </span>
      </div>

      {/* Stats row: prize, spots, starts-in, actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 0.85fr 1fr auto",
          alignItems: "end",
          gap: "16px",
          marginTop: "13px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255, 255, 255, 0.07)",
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <small style={{ color: "#85878d", fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            1st prize
          </small>
          <strong style={{ color: GOLD, fontSize: "16px", letterSpacing: "-0.02em" }}>${event.prize.toLocaleString()}</strong>
        </span>

        <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <small style={{ color: "#85878d", fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Spots
          </small>
          <strong style={{ color: "#fff", fontSize: "13px" }}>
            {event.spots} / {event.maxSpots}
          </strong>
        </span>

        <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <small style={{ color: "#85878d", fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {isLive ? "Status" : "Starts in"}
          </small>
          <strong style={{ color: isLive ? GREEN : "#fff", fontSize: "13px" }}>{formatCountdown(remaining)}</strong>
        </span>

        <div style={{ display: "flex", gap: "8px" }}>
          <motion.button
            type="button"
            onClick={onDonate}
            whileHover={{ backgroundColor: PURPLE_HOVER, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              height: "34px",
              minWidth: "94px",
              padding: "0 14px",
              border: `1px solid ${PURPLE_BORDER}`,
              borderRadius: "8px",
              backgroundColor: PURPLE,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: `0 3px 0 ${PURPLE_DARK}`,
              fontFamily: "inherit",
              transition: "background-color 0.18s",
            }}
          >
            Donate
          </motion.button>

          <motion.button
            type="button"
            onClick={isLive ? onWatch : onJoin}
            whileHover={{ backgroundColor: event.joined && !isLive ? JOINED_HOVER : BRAND_HOVER, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              height: "34px",
              minWidth: "118px",
              padding: "0 14px",
              border: `1px solid ${event.joined && !isLive ? "#2c7849" : WINE}`,
              borderRadius: "8px",
              backgroundColor: event.joined && !isLive ? "#318e54" : BRAND,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: event.joined && !isLive ? "0 3px 0 #1e5b37" : `0 3px 0 ${BRAND_DARK}`,
              fontFamily: "inherit",
              transition: "background-color 0.18s",
            }}
          >
            {isLive ? "Watch" : event.joined ? "Joined ✓" : "Join"}
          </motion.button>
        </div>
      </div>
    </article>
  );
}
