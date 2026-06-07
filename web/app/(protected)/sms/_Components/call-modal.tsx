"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { PhoneIcon } from "./phone-icon";
import { useMicStream } from "./use-mic-stream";
import { VoiceWaveLive } from "./voice-wave-live";

interface CallModalProps {
  isOpen: boolean;
  recipientLabel: string;
  recipientSubLabel: string | null;
  onEndCall: () => void;
}

const WAVE_BARS = [0.45, 0.8, 0.55, 1, 0.7, 0.35, 0.9, 0.6, 0.85, 0.4];
const WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL;

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");

  return `${mm}:${ss}`;
}

function statusLabel(status: ReturnType<typeof useMicStream>["status"]) {
  switch (status) {
    case "requesting":
      return "Asking for microphone…";
    case "recording":
      return "Calling…";
    case "denied":
      return "Microphone denied";
    case "error":
      return "Microphone unavailable";
    default:
      return "Calling…";
  }
}

export function CallModal({
  isOpen,
  recipientLabel,
  recipientSubLabel,
  onEndCall,
}: CallModalProps) {
  const [elapsed, setElapsed] = useState(0);

  const { status, error, analyser } = useMicStream({
    open: isOpen,
    wsUrl: WS_URL,
  });

  useEffect(() => {
    if (!isOpen) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => clearInterval(id);
  }, [isOpen]);

  const statusColor =
    status === "denied" || status === "error"
      ? "text-red-500"
      : "text-red-400";

  return (
    <Modal
      backdrop="opaque"
      classNames={{
        backdrop: "bg-black/30 backdrop-blur-sm",
        base: "bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 border border-zinc-700/40 ring-1 ring-inset ring-white/[0.02] shadow-xl shadow-black/50",
        body: "py-8",
      }}
      hideCloseButton
      isDismissable={false}
      isOpen={isOpen}
      placement="center"
      size="md"
    >
      <ModalContent>
        <ModalBody>
          <div className="flex flex-col items-center gap-5">
            <Avatar
              className="bg-gradient-to-br from-zinc-100 to-zinc-300 text-red-700 shadow-lg shadow-black/40 ring-2 ring-white/20"
              icon={<PhoneIcon size={28} />}
              size="md"
              style={{ width: 72, height: 72 }}
            />

            <div className="flex flex-col items-center gap-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                {recipientLabel}
              </h2>
              {recipientSubLabel && (
                <span className="text-tiny text-zinc-500">
                  {recipientSubLabel}
                </span>
              )}
              <span
                className={`text-tiny uppercase tracking-widest mt-0.5 ${statusColor}`}
              >
                {statusLabel(status)}
              </span>
              {error && (
                <span className="text-tiny text-zinc-500 mt-0.5">{error}</span>
              )}
            </div>

            {analyser ? (
              <VoiceWaveLive analyser={analyser} />
            ) : (
              <div
                aria-hidden
                className="flex items-center justify-center gap-1 h-10 mt-1"
              >
                {WAVE_BARS.map((peak, i) => (
                  <span
                    key={i}
                    className="voice-wave-bar w-1 rounded-full bg-gradient-to-b from-red-400 to-red-600"
                    style={{
                      height: `${peak * 100}%`,
                      animationDelay: `${i * 90}ms`,
                    }}
                  />
                ))}
              </div>
            )}

            <span
              aria-live="polite"
              className="font-mono text-xl tracking-wider text-zinc-300 tabular-nums"
            >
              {formatElapsed(elapsed)}
            </span>

            <Button
              aria-label="End call"
              className="bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-md shadow-red-950/50 mt-1"
              isIconOnly
              radius="full"
              size="md"
              onPress={onEndCall}
            >
              <PhoneIcon size={22} style={{ transform: "rotate(135deg)" }} />
            </Button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
