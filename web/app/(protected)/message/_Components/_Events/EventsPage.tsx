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

const HOUR = 1000 * 60 * 60;

const INITIAL_EVENTS: EventData[] = [
  { id: "e1", game: "cs2", name: "Counter-Strike 2 Clash", prize: 1500, spots: 385, maxSpots: 500, startsAt: NOW + HOUR * 26, joined: false },
  { id: "e1b", game: "cs2", name: "CS2 Retake Rush", prize: 400, spots: 120, maxSpots: 200, startsAt: NOW + HOUR * 50, joined: false },
  { id: "e1c", game: "cs2", name: "CS2 Weekend Cup", prize: 900, spots: 210, maxSpots: 256, startsAt: NOW + HOUR * 74, joined: false },
  { id: "e2", game: "valorant", name: "Valorant Showdown", prize: 800, spots: 240, maxSpots: 300, startsAt: NOW + 1000 * 60 * 45, joined: false },
  { id: "e2b", game: "valorant", name: "Valorant Spike Rush Night", prize: 300, spots: 90, maxSpots: 160, startsAt: NOW + HOUR * 30, joined: false },
  { id: "e3", game: "minecraft", name: "Minecraft Build-Off", prize: 250, spots: 64, maxSpots: 100, startsAt: NOW - 1000 * 60 * 5, joined: true },
  { id: "e4", game: "rust", name: "Rust Wipe Night", prize: 500, spots: 48, maxSpots: 80, startsAt: NOW + HOUR * 24 * 3, joined: false },
  { id: "e4b", game: "rust", name: "Rust Raid Weekend", prize: 350, spots: 30, maxSpots: 60, startsAt: NOW + HOUR * 24 * 5, joined: false },
  { id: "e5", game: "among-us", name: "Among Us Mayhem", prize: 100, spots: 10, maxSpots: 10, startsAt: NOW + HOUR * 6, joined: false },
  { id: "e6", game: "rocket-league", name: "Rocket League 3v3 Cup", prize: 600, spots: 52, maxSpots: 96, startsAt: NOW + HOUR * 12, joined: false },
  { id: "e6b", game: "rocket-league", name: "Rocket League Rumble", prize: 200, spots: 20, maxSpots: 64, startsAt: NOW + HOUR * 36, joined: false },
];

/** Games shown in the picker grid; `id` matches EventData.game and /images/games/<id>.png. */
const GAMES = [
  { id: "cs2", name: "Counter-Strike 2" },
  { id: "valorant", name: "Valorant" },
  { id: "minecraft", name: "Minecraft" },
  { id: "rust", name: "Rust" },
  { id: "among-us", name: "Among Us" },
  { id: "rocket-league", name: "Rocket League" },
];

export default function EventsPage({ onClose }: { onClose?: () => void }) {
  const [events, setEvents] = useState<EventData[]>(INITIAL_EVENTS);
  const [gameId, setGameId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);

  const game = GAMES.find((g) => g.id === gameId) ?? null;
  const gameEvents = events.filter((e) => e.game === gameId);
  const visibleGames = GAMES.filter((g) =>
    g.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

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

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1120px", margin: "0 auto", padding: "40px 24px 72px" }}>

        {!game ? (
          <>
            {/* ── Game picker ─────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", marginBottom: "28px", paddingRight: "44px" }}>
              <div>
                <h1 style={{ color: C.w, fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Events</h1>
                <p style={{ color: C.gi, fontSize: "15px", margin: "4px 0 0" }}>Choose a game to explore its events.</p>
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "280px",
                  height: "46px",
                  padding: "0 16px",
                  border: `1px solid ${C.bd}`,
                  borderRadius: "999px",
                  background: "#232428",
                  color: C.gi,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
                <input
                  aria-label="Search games"
                  placeholder="Search games"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: C.w, fontSize: "14px", fontFamily: "inherit" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "20px" }}>
              {visibleGames.map((g, i) => {
                const list = events.filter((e) => e.game === g.id);
                const live = list.filter((e) => e.startsAt <= NOW).length;
                const upcoming = list.length - live;

                return (
                  <motion.button
                    key={g.id}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    onClick={() => setGameId(g.id)}
                    onMouseEnter={() => setHovered(g.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(g.id)}
                    onBlur={() => setHovered(null)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "36px 16px 32px",
                      border: `2px solid ${hovered === g.id ? "#ff3b47" : "#37393e"}`,
                      borderRadius: "10px",
                      background: "rgba(255, 255, 255, 0.015)",
                      color: C.w,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "border-color 0.15s",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" height={84} src={`/images/games/${g.id}.png`} width={84} />
                    <strong style={{ marginTop: "20px", fontSize: "21px", fontWeight: 700 }}>{g.name}</strong>
                    {live > 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", marginTop: "6px", color: "#2fe06b", fontSize: "16px", fontWeight: 600 }}>
                        <i style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2fe06b" }} />
                        {live} live event{live !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span style={{ marginTop: "6px", color: C.gi, fontSize: "16px" }}>
                        {upcoming} upcoming event{upcoming !== 1 ? "s" : ""}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            {visibleGames.length === 0 && (
              <p style={{ color: C.gm, fontSize: "14px", textAlign: "center", marginTop: "40px" }}>No games found.</p>
            )}
          </>
        ) : (
          <>
            {/* ── Events of the chosen game ───────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", paddingRight: "44px" }}
            >
              <button
                type="button"
                aria-label="Back to games"
                onClick={() => setGameId(null)}
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "36px",
                  height: "36px",
                  border: `1px solid ${C.bd}`,
                  borderRadius: "50%",
                  background: C.surf,
                  color: C.gi,
                  cursor: "pointer",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <div>
                <h2 style={{ color: C.w, fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>{game.name}</h2>
                <p style={{ color: C.ga, fontSize: "12px", margin: "2px 0 0" }}>
                  {gameEvents.length} event{gameEvents.length !== 1 ? "s" : ""} open for registration
                </p>
              </div>
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <AnimatePresence>
                {gameEvents.map((event, i) => (
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
          </>
        )}

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
