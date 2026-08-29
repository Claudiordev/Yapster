"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Zap, Shield, Globe, Cpu, Users, Clock } from "lucide-react";
import { C } from "./palette";
import { FloatingIcon, MinecraftIcon, ValorantIcon, RustIcon, Spark } from "./GameIcons";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 4,
    ram: "2 GB",
    slots: 10,
    storage: "20 GB SSD",
    regions: 3,
    backups: false,
    ddos: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 9,
    ram: "6 GB",
    slots: 40,
    storage: "60 GB NVMe",
    regions: 8,
    backups: true,
    ddos: true,
    popular: true,
  },
  {
    id: "elite",
    name: "Elite",
    price: 18,
    ram: "16 GB",
    slots: 128,
    storage: "200 GB NVMe",
    regions: 14,
    backups: true,
    ddos: true,
  },
];

const FEATURES = [
  { Icon: Zap,    label: "Instant deployment",       desc: "Server live in under 30 seconds." },
  { Icon: Shield, label: "DDoS protection",           desc: "Hardware-level mitigation on Pro+." },
  { Icon: Globe,  label: "Global network",            desc: "14 regions across 5 continents." },
  { Icon: Cpu,    label: "Dedicated vCPUs",           desc: "No noisy neighbours, ever." },
  { Icon: Users,  label: "Unlimited invites",         desc: "Share access with your whole crew." },
  { Icon: Clock,  label: "Daily backups",             desc: "Automatic snapshots on Pro+." },
];

interface Props {
  onClose: () => void;
  onBuy: (planId: string) => void;
}

export default function BuyServerModal({ onClose, onBuy }: Props) {
  const [selected, setSelected] = useState("pro");
  const [billing, setBilling]   = useState<"monthly" | "yearly">("monthly");
  const [step, setStep]         = useState<"plan" | "confirm">("plan");
  const [purchasing, setPurchasing] = useState(false);

  const plan = PLANS.find(p => p.id === selected)!;
  const price = billing === "yearly" ? Math.round(plan.price * 0.8) : plan.price;

  function handleBuy() {
    setPurchasing(true);
    setTimeout(() => {
      onBuy(selected);
      onClose();
    }, 1400);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        overflowY: "auto",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        style={{
          backgroundColor: C.surf, borderRadius: "20px",
          border: `1px solid ${C.bd}`,
          boxShadow: `0 48px 100px rgba(0,0,0,0.7), 0 0 0 1px ${C.bd}`,
          width: "100%", maxWidth: "680px",
          overflow: "hidden", position: "relative",
        }}
      >
        {/* Ambient top glow */}
        <div style={{
          position: "absolute", top: "-60px", left: "50%", transform: "translateX(-50%)",
          width: "400px", height: "160px",
          background: `radial-gradient(ellipse, ${C.redD}66 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Header */}
        <div style={{
          position: "relative", padding: "28px 28px 0",
          background: `linear-gradient(180deg, ${C.redD}22 0%, transparent 100%)`,
        }}>
          {/* Floating icons top-right */}
          <div style={{ position: "absolute", top: "10px", right: "52px", opacity: 0.22, pointerEvents: "none" }}>
            <FloatingIcon delay={0} dy={7}><MinecraftIcon size={40} /></FloatingIcon>
          </div>
          <div style={{ position: "absolute", top: "20px", right: "100px", opacity: 0.18, pointerEvents: "none" }}>
            <FloatingIcon delay={0.7} dy={9}><ValorantIcon size={32} /></FloatingIcon>
          </div>
          <div style={{ position: "absolute", top: "8px", right: "148px", opacity: 0.15, pointerEvents: "none" }}>
            <FloatingIcon delay={1.3} dy={6}><RustIcon size={28} /></FloatingIcon>
          </div>
          <svg style={{ position: "absolute", top: 0, right: 0, width: "200px", height: "80px", pointerEvents: "none" }} viewBox="0 0 200 80">
            <Spark x={30}  y={20} r={3.5} d={0}   />
            <Spark x={80}  y={12} r={3}   d={0.8} />
            <Spark x={170} y={30} r={4}   d={1.5} />
          </svg>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
            <div>
              <p style={{ color: C.red, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 6px" }}>
                ✦ Add a Server Slot
              </p>
              <h2 style={{ color: C.w, fontSize: "22px", fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                Choose your plan
              </h2>
              <p style={{ color: C.gm, fontSize: "13px", margin: 0 }}>
                Pick the power level that fits your community.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: C.bd }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              style={{ background: "none", border: "none", color: C.ga, cursor: "pointer", borderRadius: "7px", padding: "5px", display: "flex", flexShrink: 0 }}
            >
              <X size={18} />
            </motion.button>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "22px 0 0" }}>
            {(["monthly", "yearly"] as const).map(b => (
              <motion.button
                key={b}
                onClick={() => setBilling(b)}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: "6px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer", border: "none",
                  backgroundColor: billing === b ? C.red : "transparent",
                  color: billing === b ? C.w : C.ga,
                  transition: "background-color 0.18s, color 0.18s",
                  fontFamily: "inherit",
                }}
              >
                {b === "monthly" ? "Monthly" : "Yearly"}
              </motion.button>
            ))}
            {billing === "yearly" && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  backgroundColor: `${C.online}22`, color: C.online,
                  fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px",
                  border: `1px solid ${C.online}44`,
                }}
              >
                Save 20%
              </motion.span>
            )}
          </div>
        </div>

        {/* Plan cards */}
        <div style={{ padding: "20px 28px 0", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {PLANS.map(p => {
            const pPrice = billing === "yearly" ? Math.round(p.price * 0.8) : p.price;
            const active = selected === p.id;
            return (
              <motion.div
                key={p.id}
                onClick={() => setSelected(p.id)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  position: "relative", borderRadius: "12px", padding: "18px 16px",
                  border: `1.5px solid ${active ? C.red : C.bd}`,
                  backgroundColor: active ? `${C.red}12` : C.bg,
                  cursor: "pointer",
                  boxShadow: active ? `0 8px 28px ${C.redD}44` : "none",
                  transition: "border-color 0.18s, background-color 0.18s, box-shadow 0.18s",
                }}
              >
                {p.popular && (
                  <div style={{
                    position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
                    backgroundColor: C.red, color: C.w, fontSize: "10px", fontWeight: 800,
                    padding: "3px 10px", borderRadius: "20px", letterSpacing: "0.1em",
                    textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ color: active ? C.w : C.gi, fontSize: "14px", fontWeight: 700 }}>{p.name}</span>
                  <motion.div
                    animate={{ scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
                    style={{
                      width: "18px", height: "18px", borderRadius: "50%",
                      backgroundColor: C.red, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Check size={11} color={C.w} strokeWidth={3} />
                  </motion.div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <span style={{ color: C.w, fontSize: "26px", fontWeight: 900, letterSpacing: "-0.03em" }}>${pPrice}</span>
                  <span style={{ color: C.ga, fontSize: "12px" }}>/mo</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {[
                    `${p.ram} RAM`,
                    `${p.slots} player slots`,
                    p.storage,
                    `${p.regions} regions`,
                    p.backups ? "Daily backups" : null,
                    p.ddos ? "DDoS protection" : null,
                  ].filter(Boolean).map(feat => (
                    <div key={feat} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Check size={11} color={active ? C.red : C.ga} strokeWidth={2.5} />
                      <span style={{ color: active ? C.gi : C.gm, fontSize: "12px" }}>{feat}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature highlights */}
        <div style={{ padding: "20px 28px 0" }}>
          <p style={{ color: C.ga, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
            Included with every plan
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            {FEATURES.map(({ Icon, label, desc }) => (
              <div key={label} style={{
                display: "flex", alignItems: "flex-start", gap: "9px",
                padding: "12px", backgroundColor: C.bg, borderRadius: "10px",
                border: `1px solid ${C.bd}`,
              }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "7px", flexShrink: 0,
                  backgroundColor: `${C.red}18`, border: `1px solid ${C.red}33`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={13} color={C.redL} />
                </div>
                <div>
                  <p style={{ color: C.gi, fontSize: "11px", fontWeight: 700, margin: "0 0 1px" }}>{label}</p>
                  <p style={{ color: C.ga, fontSize: "10px", margin: 0, lineHeight: 1.4 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div style={{
          padding: "20px 28px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
          borderTop: `1px solid ${C.bd}`, marginTop: "20px",
        }}>
          <div>
            <p style={{ color: C.gi, fontSize: "13px", margin: "0 0 2px" }}>
              <strong style={{ color: C.w }}>{plan.name}</strong> · billed {billing}
            </p>
            <p style={{ color: C.ga, fontSize: "12px", margin: 0 }}>
              ${price}/mo · Cancel anytime
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <motion.button
              whileHover={{ backgroundColor: C.bd }}
              onClick={onClose}
              style={{
                background: "none", border: `1px solid ${C.bd}`, borderRadius: "9px",
                color: C.gi, fontSize: "14px", fontWeight: 600, padding: "11px 20px",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={!purchasing ? { backgroundColor: C.redL, scale: 1.03 } : {}}
              whileTap={!purchasing ? { scale: 0.97 } : {}}
              onClick={handleBuy}
              disabled={purchasing}
              style={{
                backgroundColor: purchasing ? C.online : C.red,
                border: "none", borderRadius: "9px",
                color: C.w, fontSize: "14px", fontWeight: 800, padding: "11px 28px",
                cursor: purchasing ? "default" : "pointer",
                transition: "background-color 0.3s",
                display: "flex", alignItems: "center", gap: "8px",
                fontFamily: "inherit", letterSpacing: "-0.01em",
                minWidth: "160px", justifyContent: "center",
              }}
            >
              <AnimatePresence mode="wait">
                {purchasing ? (
                  <motion.span key="buying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                      style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.w}`, borderTopColor: "transparent" }}
                    />
                    Processing…
                  </motion.span>
                ) : (
                  <motion.span key="buy" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Buy {plan.name} · ${price}/mo
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
