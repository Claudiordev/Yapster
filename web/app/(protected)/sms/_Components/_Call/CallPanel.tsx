"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { formatElapsed } from "./call-utils";
import { ScreenShareStage, ScreenShareTile } from "./ScreenShareView";
import { useCall } from "./useCall";

import { Icon } from "@/components/icon";
import type { MessageSender } from "../_Chat/ChatThread";

interface CallPanelProps {
  conversationId: string;
  /** identity (userId) -> display name/avatar, same map ChatThread uses for senders. */
  senders: Record<string, MessageSender>;
  onClose: () => void;
}

/** Live voice call for one conversation -- DM or group, LiveKit treats them the same. */
export function CallPanel({ conversationId, senders, onClose }: CallPanelProps) {
  const {
    connected,
    connecting,
    reconnecting,
    participants,
    muted,
    screenSharing,
    screenShares,
    join,
    leave,
    scheduleLeave,
    toggleMute,
    toggleScreenShare,
  } = useCall(conversationId);

  const [elapsed, setElapsed] = useState(0);
  /** Identity of the share being watched full-size, if any. */
  const [watching, setWatching] = useState<string | null>(null);

  const localIdentity = participants.find((p) => p.isLocal)?.identity;
  const watched = screenShares.find((s) => s.identity === watching) ?? null;

  const sharerName = (identity: string) =>
    identity === localIdentity ? "You" : (senders[identity]?.name ?? "Someone");

  // Drop back to the tiles if whoever we were watching stopped sharing.
  useEffect(() => {
    if (watching && !screenShares.some((s) => s.identity === watching)) {
      setWatching(null);
    }
  }, [screenShares, watching]);

  // Join as soon as the panel mounts. The cleanup defers the leave so React
  // StrictMode's throwaway unmount/remount in dev doesn't rebuild the whole
  // call -- a real unmount still leaves a moment later. See useCall.
  useEffect(() => {
    join();

    return () => scheduleLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => clearInterval(id);
  }, [connected]);

  function handleClose() {
    leave();
    onClose();
  }

  return (
    <div className="flex-shrink-0 flex flex-col gap-4 px-4 pt-6 pb-6 bg-gradient-to-b from-content2 to-content1 border-b border-divider">
      <div className="flex items-center justify-between">
        <span className="text-tiny font-medium uppercase tracking-widest text-brand">
          {connecting
            ? "Connecting…"
            : reconnecting
              ? "Reconnecting…"
              : connected
                ? formatElapsed(elapsed)
                : "Call"}
        </span>
        <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
          <Icon name="close" size={16} />
        </Button>
      </div>

      {/* Watching one screen full-size takes over; otherwise every sharer gets
          a tile you can open. */}
      {watched ? (
        <ScreenShareStage
          key={watched.identity}
          name={sharerName(watched.identity)}
          share={watched}
          onClose={() => setWatching(null)}
        />
      ) : (
        screenShares.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {screenShares.map((share) => (
              <ScreenShareTile
                key={share.identity}
                name={sharerName(share.identity)}
                share={share}
                onWatch={() => setWatching(share.identity)}
              />
            ))}
          </div>
        )
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        {participants.map((p) => {
          const sender = senders[p.identity];
          const name = p.isLocal ? "You" : (sender?.name ?? "Unknown");

          return (
            <div key={p.identity} className="flex flex-col items-center gap-1.5">
              <div
                className={`rounded-full p-1 ${
                  p.isSpeaking ? "ring-2 ring-danger" : ""
                }`}
              >
                <Avatar
                  className="bg-brand text-white"
                  name={name.charAt(0).toUpperCase()}
                  size="lg"
                  src={sender?.avatarUrl ?? undefined}
                />
              </div>
              <span className="flex items-center gap-1 text-tiny text-default-500">
                {p.isMuted && <Icon name="mic-off" size={12} />}
                {name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          isIconOnly
          aria-label={muted ? "Unmute" : "Mute"}
          className={muted ? "bg-danger/15 text-danger" : "bg-content2"}
          isDisabled={!connected}
          radius="full"
          onPress={toggleMute}
        >
          <Icon name={muted ? "mic-off" : "mic"} size={18} />
        </Button>

        <Button
          isIconOnly
          aria-label={screenSharing ? "Stop sharing screen" : "Share screen"}
          className={screenSharing ? "bg-brand/15 text-brand" : "bg-content2"}
          isDisabled={!connected}
          radius="full"
          onPress={toggleScreenShare}
        >
          <Icon name="screen-share" size={18} />
        </Button>

        <Button
          isIconOnly
          aria-label="Leave call"
          className="bg-danger text-white"
          radius="full"
          onPress={handleClose}
        >
          <Icon className="rotate-[135deg]" name="phone" size={18} />
        </Button>
      </div>
    </div>
  );
}
