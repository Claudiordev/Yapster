"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import { C } from "./palette";
import { MinecraftIcon, CS2Icon, AmongUsIcon, ValorantIcon, RustIcon, FloatingIcon } from "./GameIcons";

const GAMES = [
  { id: "minecraft", label: "Minecraft", Icon: MinecraftIcon },
  { id: "cs2",       label: "CS2",       Icon: CS2Icon },
  { id: "among-us",  label: "Among Us",  Icon: AmongUsIcon },
  { id: "valorant",  label: "Valorant",  Icon: ValorantIcon },
  { id: "rust",      label: "Rust",      Icon: RustIcon },
];

const REGIONS = ["US East", "US West", "EU West", "EU Central", "Asia Pacific", "South America"];

interface Props {
  onClose: () => void;
  onAdd: (server: { game: string; name: string; region: string }) => void;
}

export default function AddServerModal({ onClose, onAdd }: Props) {
  const [game, setGame] = useState("");
  const [name, setName] = useState("My server");
  const [region, setRegion] = useState("");
  const [gameOpen, setGameOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);

  const selectedGame = GAMES.find(g => g.id === game);

  function handleAdd() {
    if (!game || !region) return;
    onAdd({ game, name: name || "My server", region });
    onClose();
  }

  const inputStyle = {
    width: "100%",
    backgroundColor: C.bg,
    border: `1px solid ${C.bd}`,
    borderRadius: "8px",
    color: C.w,
    fontSize: "14px",
    padding: "10px 14px",
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        style={{
          backgroundColor: C.surf,
          borderRadius: "16px",
          border: `1px solid ${C.bd}`,
          boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${C.bd}`,
          display: "flex",
          gap: "0",
          overflow: "hidden",
          maxWidth: "560px",
          width: "100%",
        }}
      >
        {/* Form side */}
        <div style={{ flex: 1, padding: "28px 28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
            <h2 style={{ color: C.w, fontSize: "18px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              Add a game server
            </h2>
            <motion.button
              whileHover={{ scale: 1.12, backgroundColor: C.bd }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              style={{ background: "none", border: "none", color: C.ga, cursor: "pointer", borderRadius: "6px", padding: "4px", display: "flex" }}
            >
              <X size={18} />
            </motion.button>
          </div>

          {/* Game picker */}
          <label style={{ display: "block", color: C.gi, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
            Game
          </label>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <motion.button
              onClick={() => { setGameOpen(o => !o); setRegionOpen(false); }}
              whileTap={{ scale: 0.98 }}
              style={{
                ...inputStyle,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer", background: C.bg,
                border: `1px solid ${gameOpen ? C.redM : C.bd}`,
                transition: "border-color 0.18s",
              }}
            >
              <span style={{ color: selectedGame ? C.w : C.ga }}>
                {selectedGame ? selectedGame.label : "Choose a game"}
              </span>
              <motion.span animate={{ rotate: gameOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} color={C.ga} />
              </motion.span>
            </motion.button>
            <AnimatePresence>
              {gameOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -6, scaleY: 0.9 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                    backgroundColor: C.surf2, border: `1px solid ${C.bd}`,
                    borderRadius: "8px", marginTop: "4px",
                    boxShadow: `0 12px 32px rgba(0,0,0,0.5)`,
                    overflow: "hidden",
                    transformOrigin: "top",
                  }}
                >
                  {GAMES.map(g => (
                    <motion.button
                      key={g.id}
                      onClick={() => { setGame(g.id); setGameOpen(false); }}
                      whileHover={{ backgroundColor: C.bd }}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        width: "100%", padding: "9px 14px",
                        background: "none", border: "none", cursor: "pointer",
                        color: g.id === game ? C.w : C.gi, fontSize: "14px", fontWeight: g.id === game ? 600 : 400,
                        textAlign: "left",
                      }}
                    >
                      <g.Icon size={24} />
                      {g.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Name */}
          <label style={{ display: "block", color: C.gi, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
            Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My server"
            style={{ ...inputStyle, marginBottom: "16px" }}
            onFocus={e => (e.currentTarget.style.borderColor = C.redM)}
            onBlur={e => (e.currentTarget.style.borderColor = C.bd)}
          />

          {/* Region */}
          <label style={{ display: "block", color: C.gi, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "8px" }}>
            Location
          </label>
          <div style={{ position: "relative", marginBottom: "20px" }}>
            <motion.button
              onClick={() => { setRegionOpen(o => !o); setGameOpen(false); }}
              whileTap={{ scale: 0.98 }}
              style={{
                ...inputStyle,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                cursor: "pointer",
                border: `1px solid ${regionOpen ? C.redM : C.bd}`,
                transition: "border-color 0.18s",
              }}
            >
              <span style={{ color: region ? C.w : C.ga }}>{region || "Choose a location"}</span>
              <motion.span animate={{ rotate: regionOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} color={C.ga} />
              </motion.span>
            </motion.button>
            <AnimatePresence>
              {regionOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -6, scaleY: 0.9 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                    backgroundColor: C.surf2, border: `1px solid ${C.bd}`,
                    borderRadius: "8px", marginTop: "4px",
                    boxShadow: `0 12px 32px rgba(0,0,0,0.5)`,
                    overflow: "hidden",
                    transformOrigin: "top",
                  }}
                >
                  {REGIONS.map(r => (
                    <motion.button
                      key={r}
                      onClick={() => { setRegion(r); setRegionOpen(false); }}
                      whileHover={{ backgroundColor: C.bd }}
                      style={{
                        display: "block", width: "100%", padding: "9px 14px",
                        background: "none", border: "none", cursor: "pointer",
                        color: r === region ? C.w : C.gi, fontSize: "14px", fontWeight: r === region ? 600 : 400,
                        textAlign: "left",
                      }}
                    >
                      {r}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p style={{ color: C.gm, fontSize: "12px", lineHeight: 1.6, marginBottom: "22px" }}>
            Game servers let you host dedicated multiplayer sessions for your community — invite friends, control access, and keep your worlds running around the clock.
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <motion.button
              whileHover={{ backgroundColor: C.bd }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{
                background: "none", border: `1px solid ${C.bd}`, borderRadius: "8px",
                color: C.gi, fontSize: "14px", fontWeight: 600, padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={game && region ? { backgroundColor: C.redL, scale: 1.02 } : {}}
              whileTap={game && region ? { scale: 0.97 } : {}}
              onClick={handleAdd}
              style={{
                backgroundColor: game && region ? C.red : C.ga,
                border: "none", borderRadius: "8px",
                color: C.w, fontSize: "14px", fontWeight: 700, padding: "10px 20px",
                cursor: game && region ? "pointer" : "not-allowed",
                transition: "background-color 0.18s",
              }}
            >
              Add server
            </motion.button>
          </div>
        </div>

        {/* Preview panel */}
        <div style={{
          width: "160px", flexShrink: 0,
          background: `linear-gradient(145deg, ${C.redD} 0%, #3A0808 60%, ${C.bg} 100%)`,
          padding: "28px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "16px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: "-40px", right: "-40px",
            width: "120px", height: "120px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${C.red}44 0%, transparent 70%)`,
          }} />

          <AnimatePresence mode="wait">
            {selectedGame ? (
              <motion.div
                key={selectedGame.id}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
                <FloatingIcon delay={0} dy={8}>
                  <selectedGame.Icon size={64} />
                </FloatingIcon>
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  width: 64, height: 64, borderRadius: "14px",
                  backgroundColor: `${C.ga}44`,
                  border: `2px dashed ${C.ga}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <span style={{ color: C.ga, fontSize: "28px", fontWeight: 300 }}>?</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            <p style={{ color: C.w, fontSize: "14px", fontWeight: 700, margin: "0 0 4px", lineHeight: 1.3 }}>
              {selectedGame ? selectedGame.label : "New game server"}
            </p>
            <p style={{ color: C.gi, fontSize: "11px", margin: 0, lineHeight: 1.4 }}>
              {selectedGame ? (region || "Pick a region") : "Pick a game, name it, choose a region."}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
