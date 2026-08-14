"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Trash2, RotateCcw, Save } from "lucide-react";
import { C } from "./palette";
import { MinecraftIcon, CS2Icon, AmongUsIcon, ValorantIcon, RustIcon, FloatingIcon } from "./GameIcons";
import type { ServerData } from "./GameServersPage";

const GAMES = [
  { id: "minecraft", label: "Minecraft",  Icon: MinecraftIcon },
  { id: "cs2",       label: "CS2",        Icon: CS2Icon },
  { id: "among-us",  label: "Among Us",   Icon: AmongUsIcon },
  { id: "valorant",  label: "Valorant",   Icon: ValorantIcon },
  { id: "rust",      label: "Rust",       Icon: RustIcon },
];

const REGIONS = ["US East", "US West", "EU West", "EU Central", "Asia Pacific", "South America"];

const MAX_PLAYER_OPTIONS = [4, 8, 10, 16, 20, 32, 64, 128];

interface Props {
  server: ServerData;
  onClose: () => void;
  onSave: (updated: ServerData) => void;
  onDelete: (id: string) => void;
}

function Dropdown<T extends string>({
  value, options, onChange, renderOption, renderValue,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
  renderOption?: (v: T) => React.ReactNode;
  renderValue?: (v: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.98 }}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          backgroundColor: C.bg, border: `1px solid ${open ? C.redM : C.bd}`,
          borderRadius: "8px", color: C.w, fontSize: "14px", padding: "10px 14px",
          cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.18s",
        }}
      >
        <span>{renderValue ? renderValue(value) : value}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={15} color={C.ga} />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.9 }}
            transition={{ duration: 0.14 }}
            style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
              backgroundColor: C.surf2, border: `1px solid ${C.bd}`,
              borderRadius: "8px", marginTop: "4px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
              overflow: "hidden", transformOrigin: "top",
            }}
          >
            {options.map(opt => (
              <motion.button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                whileHover={{ backgroundColor: C.bd }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  width: "100%", padding: "9px 14px", background: "none", border: "none",
                  cursor: "pointer", color: opt === value ? C.w : C.gi,
                  fontSize: "14px", fontWeight: opt === value ? 600 : 400,
                  textAlign: "left", fontFamily: "inherit",
                }}
              >
                {renderOption ? renderOption(opt) : opt}
                {opt === value && (
                  <span style={{ marginLeft: "auto", color: C.red, fontSize: "11px" }}>✓</span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ServerSettingsModal({ server, onClose, onSave, onDelete }: Props) {
  const [name, setName]         = useState(server.name);
  const [game, setGame]         = useState(server.game);
  const [region, setRegion]     = useState(server.region);
  const [maxPlayers, setMax]    = useState(String(server.maxPlayers));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restarting, setRestarting]       = useState(false);
  const [saved, setSaved]                 = useState(false);

  const selectedGame = GAMES.find(g => g.id === game)!;
  const dirty = name !== server.name || game !== server.game || region !== server.region || maxPlayers !== String(server.maxPlayers);

  function handleSave() {
    onSave({ ...server, name, game, region, maxPlayers: Number(maxPlayers) });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  function handleRestart() {
    setRestarting(true);
    setTimeout(() => setRestarting(false), 2000);
  }

  function handleDelete() {
    onDelete(server.id);
    onClose();
  }

  const labelStyle = {
    display: "block", color: C.gi, fontSize: "11px", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: "7px",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        style={{
          backgroundColor: C.surf, borderRadius: "18px",
          border: `1px solid ${C.bd}`,
          boxShadow: `0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px ${C.bd}`,
          width: "100%", maxWidth: "520px",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 24px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <FloatingIcon delay={0} dy={5}>
              <selectedGame.Icon size={36} />
            </FloatingIcon>
            <div>
              <h2 style={{ color: C.w, fontSize: "17px", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
                Server Settings
              </h2>
              <p style={{ color: C.ga, fontSize: "12px", margin: 0 }}>{server.name}</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: C.bd }}
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.ga, cursor: "pointer", borderRadius: "7px", padding: "5px", display: "flex" }}
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: C.bd, margin: "18px 0 0" }} />

        {/* Body */}
        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* Name */}
          <div>
            <label style={labelStyle}>Server Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{
                width: "100%", backgroundColor: C.bg, border: `1px solid ${C.bd}`,
                borderRadius: "8px", color: C.w, fontSize: "14px", padding: "10px 14px",
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                transition: "border-color 0.18s",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = C.redM)}
              onBlur={e => (e.currentTarget.style.borderColor = C.bd)}
            />
          </div>

          {/* Game */}
          <div>
            <label style={labelStyle}>Game</label>
            <Dropdown
              value={game}
              options={GAMES.map(g => g.id)}
              onChange={setGame}
              renderValue={v => {
                const g = GAMES.find(g => g.id === v);
                return (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {g && <g.Icon size={20} />} {g?.label}
                  </span>
                );
              }}
              renderOption={v => {
                const g = GAMES.find(g => g.id === v);
                return <>{g && <g.Icon size={20} />} {g?.label}</>;
              }}
            />
          </div>

          {/* Two-col: region + max players */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Region</label>
              <Dropdown value={region} options={REGIONS} onChange={setRegion} />
            </div>
            <div>
              <label style={labelStyle}>Max Players</label>
              <Dropdown
                value={maxPlayers}
                options={MAX_PLAYER_OPTIONS.map(String)}
                onChange={setMax}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: C.bd }} />

          {/* Danger zone / actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {/* Restart */}
            <motion.button
              whileHover={{ backgroundColor: `${C.idle}18`, borderColor: C.idle }}
              whileTap={{ scale: 0.97 }}
              onClick={handleRestart}
              disabled={restarting}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "9px 16px", borderRadius: "8px",
                background: "none", border: `1px solid ${C.bd}`,
                color: restarting ? C.idle : C.gi, fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.18s", fontFamily: "inherit",
              }}
            >
              <motion.span
                animate={restarting ? { rotate: 360 } : { rotate: 0 }}
                transition={restarting ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
                style={{ display: "flex" }}
              >
                <RotateCcw size={14} />
              </motion.span>
              {restarting ? "Restarting…" : "Restart"}
            </motion.button>

            {/* Delete */}
            <motion.button
              whileHover={{ backgroundColor: `${C.red}18`, borderColor: C.red }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setConfirmDelete(true)}
              style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "9px 16px", borderRadius: "8px",
                background: "none", border: `1px solid ${C.bd}`,
                color: C.redL, fontSize: "13px", fontWeight: 600,
                cursor: "pointer", transition: "all 0.18s", fontFamily: "inherit",
              }}
            >
              <Trash2 size={14} /> Delete server
            </motion.button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px 22px",
          display: "flex", justifyContent: "flex-end", gap: "10px",
          borderTop: `1px solid ${C.bd}`,
        }}>
          <motion.button
            whileHover={{ backgroundColor: C.bd }}
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            style={{
              background: "none", border: `1px solid ${C.bd}`, borderRadius: "8px",
              color: C.gi, fontSize: "14px", fontWeight: 600, padding: "10px 22px",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={dirty ? { backgroundColor: C.redL, scale: 1.02 } : {}}
            whileTap={dirty ? { scale: 0.97 } : {}}
            onClick={handleSave}
            style={{
              backgroundColor: saved ? C.online : dirty ? C.red : C.ga,
              border: "none", borderRadius: "8px",
              color: C.w, fontSize: "14px", fontWeight: 700, padding: "10px 22px",
              cursor: dirty ? "pointer" : "default",
              transition: "background-color 0.2s",
              display: "flex", alignItems: "center", gap: "7px",
              fontFamily: "inherit",
            }}
          >
            <Save size={14} />
            {saved ? "Saved!" : "Save changes"}
          </motion.button>
        </div>
      </motion.div>

      {/* Confirm delete overlay */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 60,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
            }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              style={{
                backgroundColor: C.surf, borderRadius: "14px",
                border: `1px solid ${C.red}55`,
                boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${C.red}44`,
                padding: "28px", maxWidth: "360px", width: "100%",
              }}
            >
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                backgroundColor: `${C.red}22`, border: `1px solid ${C.red}44`,
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px",
              }}>
                <Trash2 size={20} color={C.red} />
              </div>
              <h3 style={{ color: C.w, fontSize: "16px", fontWeight: 800, margin: "0 0 8px" }}>
                Delete "{server.name}"?
              </h3>
              <p style={{ color: C.gm, fontSize: "13px", lineHeight: 1.6, margin: "0 0 22px" }}>
                This will permanently shut down and remove this server. All data will be lost and cannot be recovered.
              </p>
              <div style={{ display: "flex", gap: "10px" }}>
                <motion.button
                  whileHover={{ backgroundColor: C.bd }}
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, background: "none", border: `1px solid ${C.bd}`,
                    borderRadius: "8px", color: C.gi, fontSize: "14px", fontWeight: 600,
                    padding: "10px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ backgroundColor: "#B01E1E" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDelete}
                  style={{
                    flex: 1, backgroundColor: C.red, border: "none",
                    borderRadius: "8px", color: C.w, fontSize: "14px", fontWeight: 700,
                    padding: "10px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
