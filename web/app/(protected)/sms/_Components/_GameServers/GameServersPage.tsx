"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Server, Zap } from "lucide-react";
import { C } from "./palette";
import { Spark, FloatingIcon, MinecraftIcon, CS2Icon, AmongUsIcon, ValorantIcon, RustIcon } from "./GameIcons";
import ServerCard, { EmptyServerSlot } from "./ServerCard";
import AddServerModal from "./AddServerModal";
import ServerSettingsModal from "./ServerSettingsModal";
import BuyServerModal from "./BuyServerModal";

export interface ServerData {
  id: string;
  game: string;
  name: string;
  region: string;
  status: "online" | "idle" | "offline";
  players: number;
  maxPlayers: number;
  cpu: number;
}

const INITIAL_SERVERS: ServerData[] = [
  { id: "s1", game: "minecraft", name: "Survival World", region: "US East",  status: "online",  players: 8, maxPlayers: 20, cpu: 34 },
  { id: "s2", game: "cs2",       name: "CS2 Competitive", region: "EU West", status: "idle",    players: 0, maxPlayers: 10, cpu: 2  },
];

const MAX_SLOTS = 4;

export default function GameServersPage({ onClose }: { onClose?: () => void }) {
  const [servers, setServers]         = useState<ServerData[]>(INITIAL_SERVERS);
  const [showAdd, setShowAdd]         = useState(false);
  const [showBuy, setShowBuy]         = useState(false);
  const [settingsId, setSettingsId]   = useState<string | null>(null);

  const settingsServer = servers.find(s => s.id === settingsId) ?? null;
  const emptySlots     = Math.max(0, MAX_SLOTS - servers.length);
  const isFull         = servers.length >= MAX_SLOTS;
  const totalOnline    = servers.filter(s => s.status === "online").length;

  function handleAdd(data: { game: string; name: string; region: string }) {
    setServers(prev => [...prev, {
      id: `s${Date.now()}`, game: data.game, name: data.name,
      region: data.region, status: "offline", players: 0, maxPlayers: 20, cpu: 0,
    }]);
  }

  function handleSaveSettings(updated: ServerData) {
    setServers(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSettingsId(null);
  }

  function handleDelete(id: string) {
    setServers(prev => prev.filter(s => s.id !== id));
    setSettingsId(null);
  }

  function handleBuy(_planId: string) {
    // In a real app: create payment session. Here just close.
  }

  return (
    <div style={{
      backgroundColor: C.bg, height: "100%", overflowY: "auto", position: "relative",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: C.w,
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)",
        width: "900px", height: "400px",
        background: `radial-gradient(ellipse, ${C.redD}44 0%, transparent 68%)`,
        pointerEvents: "none", zIndex: 0,
      }} />

      {onClose && (
        <button
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute", top: "16px", right: "20px", zIndex: 3,
            width: "34px", height: "34px", borderRadius: "50%",
            border: `1px solid ${C.bd}`, backgroundColor: C.surf, color: C.gi,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: "980px", margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* ── Hero Banner ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "relative", borderRadius: "18px", overflow: "hidden",
            marginBottom: "32px",
            background: `linear-gradient(125deg, ${C.redD} 0%, ${C.red} 45%, ${C.redD} 78%, ${C.bg} 100%)`,
            boxShadow: `0 8px 48px ${C.redD}88`,
            minHeight: "160px",
          }}
        >
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.09) 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
          }} />

          {/* Floating game icons — full opacity, spread across right half */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>

            <div style={{ position: "absolute", right: "260px", top: "18px" }}>
              <FloatingIcon delay={0} dy={10}><RustIcon size={64} /></FloatingIcon>
            </div>
            <div style={{ position: "absolute", right: "174px", top: "36px" }}>
              <FloatingIcon delay={0.5} dy={8}><ValorantIcon size={72} /></FloatingIcon>
            </div>
            <div style={{ position: "absolute", right: "88px", top: "10px" }}>
              <FloatingIcon delay={1.0} dy={12}><MinecraftIcon size={80} /></FloatingIcon>
            </div>
            <div style={{ position: "absolute", right: "18px", top: "50px" }}>
              <FloatingIcon delay={1.6} dy={7}><CS2Icon size={60} /></FloatingIcon>
            </div>
            <div style={{ position: "absolute", right: "340px", top: "60px" }}>
              <FloatingIcon delay={0.8} dy={9}><AmongUsIcon size={56} /></FloatingIcon>
            </div>

            {/* Sparkles */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 900 180" preserveAspectRatio="none">
              <Spark x={830} y={24}  r={5.5} d={0}   />
              <Spark x={750} y={148} r={4.5} d={0.7} />
              <Spark x={640} y={18}  r={4}   d={1.3} />
              <Spark x={870} y={110} r={5}   d={0.4} />
              <Spark x={550} y={140} r={3.5} d={1.0} />
            </svg>

            {/* Right edge fade so icons don't clip harshly */}
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: "16px",
              background: `linear-gradient(90deg, transparent, ${C.bg})`,
            }} />
          </div>

          {/* Content */}
          <div style={{ position: "relative", padding: "32px 32px 28px", zIndex: 1, maxWidth: "480px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{
                backgroundColor: "rgba(255,255,255,0.16)", borderRadius: "8px", padding: "6px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Server size={17} color={C.w} />
              </div>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                Game Servers
              </span>
            </div>

            <h1 style={{ color: C.w, fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 900, letterSpacing: "-0.025em", margin: "0 0 6px", lineHeight: 1.15 }}>
              Spin up a server.
            </h1>
            <p style={{ color: "rgba(255,255,255,0.68)", fontSize: "14px", margin: "0 0 22px" }}>
              Invite your friends and start playing in seconds.
            </p>

            {/* Stats pills */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {[
                { icon: <Zap size={12} />, label: `${totalOnline} online`,            accent: true  },
                { icon: <Server size={12} />, label: `${servers.length}/${MAX_SLOTS} slots`, accent: false },
              ].map(({ icon, label, accent }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  backgroundColor: accent ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.24)",
                  border: "1px solid rgba(255,255,255,0.13)", borderRadius: "20px", padding: "5px 12px",
                  backdropFilter: "blur(6px)",
                }}>
                  <span style={{ color: C.w, opacity: 0.8 }}>{icon}</span>
                  <span style={{ color: C.w, fontSize: "12px", fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Section row ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}
        >
          <div>
            <h2 style={{ color: C.gi, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 2px" }}>
              Your Servers
            </h2>
            <p style={{ color: C.ga, fontSize: "12px", margin: 0 }}>
              {servers.length > 0
                ? `${servers.length} server${servers.length !== 1 ? "s" : ""} configured`
                : "No servers yet — add one below"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {!isFull && (
              <motion.button
                whileHover={{ backgroundColor: C.redM, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAdd(true)}
                style={{
                  backgroundColor: C.red, border: "none", borderRadius: "8px",
                  color: C.w, fontSize: "13px", fontWeight: 700, padding: "9px 18px",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "7px",
                  transition: "background-color 0.18s", fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Add Server
              </motion.button>
            )}
            <motion.button
              whileHover={{ backgroundColor: C.bd, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowBuy(true)}
              style={{
                background: "none", border: `1px solid ${C.bd}`, borderRadius: "8px",
                color: C.gi, fontSize: "13px", fontWeight: 600, padding: "9px 16px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "7px",
                transition: "background-color 0.18s", fontFamily: "inherit",
              }}
            >
              ⚡ Buy Slots
            </motion.button>
          </div>
        </motion.div>

        {/* ── Grid ────────────────────────────────────────────── */}
        <motion.div
          layout
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))",
            gap: "16px",
          }}
        >
          <AnimatePresence>
            {servers.map((s, i) => (
              <ServerCard
                key={s.id}
                server={s}
                index={i}
                onSettings={() => setSettingsId(s.id)}
              />
            ))}
          </AnimatePresence>

          {isFull ? (
            <EmptyServerSlot
              key="buy-slot"
              index={servers.length}
              onClick={() => setShowBuy(true)}
              onBuy={() => setShowBuy(true)}
              isFull
            />
          ) : (
            Array.from({ length: emptySlots }).map((_, i) => (
              <EmptyServerSlot
                key={`empty-${i}`}
                index={servers.length + i}
                onClick={() => setShowAdd(true)}
                onBuy={() => setShowBuy(true)}
              />
            ))
          )}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            color: C.ga, fontSize: "11px", letterSpacing: "0.16em",
            textTransform: "uppercase", textAlign: "center", marginTop: "52px", marginBottom: 0,
          }}
        >
          Yapp · Game Servers
        </motion.p>
      </div>

      {/* ── Modals ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <AddServerModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBuy && (
          <BuyServerModal onClose={() => setShowBuy(false)} onBuy={handleBuy} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsServer && (
          <ServerSettingsModal
            server={settingsServer}
            onClose={() => setSettingsId(null)}
            onSave={handleSaveSettings}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
