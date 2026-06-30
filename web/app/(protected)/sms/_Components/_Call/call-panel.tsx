"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { formatElapsed, statusLabel } from "./call-utils";
import { useMicStream } from "./use-mic-stream";
import { useRingback } from "./use-ringback";
import { VoiceRing } from "./voice-ring";
import { Icon } from "@/components/icon";
import { useAccount } from "@/lib/use-account";

interface CallPanelProps {
  recipientLabel: string;
  recipientSubLabel: string | null;
  onEndCall: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL;
const CONNECT_DELAY_MS = 5000;

export function CallPanel({
  recipientLabel,
  recipientSubLabel,
  onEndCall,
}: CallPanelProps) {
  const { username } = useAccount();
  const [connected, setConnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Ring while connecting; the mic only opens once the call connects.
  useRingback(!connected);
  const { status, error, analyser } = useMicStream({
    open: connected,
    wsUrl: WS_URL,
  });

  // 5-second "Connecting…" phase before the call goes live.
  useEffect(() => {
    const id = setTimeout(() => setConnected(true), CONNECT_DELAY_MS);

    return () => clearTimeout(id);
  }, []);

  // Timer only starts once connected.
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => clearInterval(id);
  }, [connected]);

  const initial = (username ?? "U").charAt(0).toUpperCase();
  const statusColor =
    connected && (status === "denied" || status === "error")
      ? "text-danger"
      : "text-brand";

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-3 px-4 pt-8 pb-8 bg-gradient-to-b from-content2 to-content1 border-b border-divider">
      <div
        className={`flex items-center justify-center ${
          connected ? "" : "animate-pulse"
        }`}
        style={{ height: 184 }}
      >
        <VoiceRing analyser={analyser}>
          <Avatar
            className="bg-brand text-white ring-4 ring-brand/20 shadow-lg shadow-black/30 relative z-10"
            name={initial}
            style={{ width: 112, height: 112, fontSize: "2.4rem" }}
          />
        </VoiceRing>
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-xl font-semibold tracking-tight text-foreground">
          {username ?? "You"}
        </span>
        <span
          className={`text-tiny font-medium uppercase tracking-widest ${statusColor}`}
        >
          {connected ? statusLabel(status) : "Connecting…"}
        </span>
        {recipientLabel && (
          <span className="text-small text-default-500">
            with {recipientLabel}
            {recipientSubLabel ? ` · ${recipientSubLabel}` : ""}
          </span>
        )}
        {error && (
          <span className="text-tiny text-default-400">{error}</span>
        )}
      </div>

      <span
        aria-live="polite"
        className="font-mono text-xl tabular-nums tracking-wider text-default-600"
      >
        {connected ? formatElapsed(elapsed) : "Ringing…"}
      </span>

      <Button
        aria-label="End call"
        className="mt-2 h-12 w-12 min-w-12 bg-brand hover:bg-brand-hover text-white shadow-lg shadow-brand/40"
        isIconOnly
        radius="full"
        onPress={onEndCall}
      >
        <Icon className="rotate-[135deg]" name="phone" size={24} />
      </Button>
    </div>
  );
}
