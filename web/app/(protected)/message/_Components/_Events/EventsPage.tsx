"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { C } from "@/app/(protected)/message/_Components/_GameServers/utils/palette";
import EventRow from "./EventRow";

export interface EventData {
  id: string;
  game: string;
  name: string;
  prize: number;
  spots: number;
  maxSpots: number;
  startsAt: number;
  joined: boolean;
}

const NOW = Date.now();

const INITIAL_EVENTS: EventData[] = [
  { id: "e1", game: "cs2", name: "Counter-Strike 2 Clash", prize: 1500, spots: 385, maxSpots: 500, startsAt: NOW + 1000 * 60 * 60 * 26, joined: false },
  { id: "e2", game: "valorant", name: "Valorant Showdown", prize: 800, spots: 240, maxSpots: 300, startsAt: NOW + 1000 * 60 * 45, joined: false },
  { id: "e3", game: "minecraft", name: "Minecraft Build-Off", prize: 250, spots: 64, maxSpots: 100, startsAt: NOW - 1000 * 60 * 5, joined: true },
  { id: "e4", game: "rust", name: "Rust Wipe Night", prize: 500, spots: 48, maxSpots: 80, startsAt: NOW + 1000 * 60 * 60 * 24 * 3, joined: false },
  { id: "e5", game: "among-us", name: "Among Us Mayhem", prize: 100, spots: 10, maxSpots: 10, startsAt: NOW + 1000 * 60 * 60 * 6, joined: false },
];

export default function EventsPage({ onClose }: { onClose?: () => void }) {
  const [events, setEvents] = useState<EventData[]>(INITIAL_EVENTS);

  function toggleJoin(id: string) {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, joined: !e.joined, spots: e.joined ? e.spots - 1 : e.spots + 1 }
          : e,
      ),
    );
  }

  function handleDonate(_id: string) {
    // In a real app: open a payment flow. Here it's a no-op stub.
  }

  function handleWatch(_id: string) {
    // In a real app: jump into the live stream/room. Here it's a no-op stub.
  }

  return (
    <div
      style={{
        backgroundColor: C.bg,
        height: "100%",
        overflowY: "auto",
        position: "relative",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: C.w,
      }}
    >
      {onClose && (
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "20px",
            zIndex: 3,
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: `1px solid ${C.bd}`,
            backgroundColor: C.surf,
            color: C.gi,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: "980px", margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* ── Section row ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}
        >
          <div>
            <h2 style={{ color: C.gi, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 2px" }}>
              Upcoming Events
            </h2>
            <p style={{ color: C.ga, fontSize: "12px", margin: 0 }}>
              {events.length} event{events.length !== 1 ? "s" : ""} open for registration
            </p>
          </div>
        </motion.div>

        {/* ── Rows ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <AnimatePresence>
            {events.map((event, i) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <EventRow
                  event={event}
                  index={i}
                  onJoin={() => toggleJoin(event.id)}
                  onDonate={() => handleDonate(event.id)}
                  onWatch={() => handleWatch(event.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            color: C.ga,
            fontSize: "11px",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            textAlign: "center",
            marginTop: "52px",
            marginBottom: 0,
          }}
        >
          Voxsi · Events
        </motion.p>
      </div>
    </div>
  );
}
