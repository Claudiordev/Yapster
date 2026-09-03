"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";

import { formatElapsed } from "./call-utils";
import { ParticipantVolumeMenu } from "./ParticipantVolumeMenu";
import {
  ScreenShareAudio,
  ScreenShareStage,
  ScreenShareTile,
} from "./ScreenShareView";
import { useCall } from "./useCall";

import { Icon } from "@/components/icon";
import { SettingsModal } from "@/components/SettingsModal";
import { useAccount } from "@/lib/use-account";
import type { MessageSender } from "../_Chat/ChatThread";

interface CallPanelProps {
  conversationId: string;
  /** identity (userId) -> display name/avatar, same map ChatThread uses for senders. */
  senders: Record<string, MessageSender>;
  onClose: () => void;
}

const MIN_CALL_HEIGHT_PERCENT = 30;
const MAX_CALL_HEIGHT_PERCENT = 60;
const DEFAULT_CALL_HEIGHT_PERCENT = 40;
const KEYBOARD_RESIZE_STEP_PERCENT = 2;

function clampCallHeight(value: number) {
  return Math.min(
    MAX_CALL_HEIGHT_PERCENT,
    Math.max(MIN_CALL_HEIGHT_PERCENT, value),
  );
}

/** Live voice call for one conversation -- DM or group, LiveKit treats them the same. */
export function CallPanel({
  conversationId,
  senders,
  onClose,
}: CallPanelProps) {
  const { roles: accountRoles } = useAccount();
  const currentUserIsAdmin = accountRoles.includes("ADMIN");
  const {
    connected,
    connecting,
    reconnecting,
    participants,
    muted,
    screenSharing,
    screenShares,
    error,
    join,
    leave,
    scheduleLeave,
    toggleMute,
    toggleScreenShare,
    setParticipantVolume,
    toggleParticipantMute,
    setScreenShareVolume,
    watchScreenShareAudio,
  } = useCall(conversationId);

  const [elapsed, setElapsed] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [participantMenu, setParticipantMenu] = useState<{
    identity: string;
    x: number;
    y: number;
  } | null>(null);
  /** Identity of the share being watched full-size, if any. */
  const [watching, setWatching] = useState<string | null>(null);
  const [callHeightPercent, setCallHeightPercent] = useState(
    DEFAULT_CALL_HEIGHT_PERCENT,
  );
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ clientY: number; height: number } | null>(
    null,
  );

  const localIdentity = participants.find((p) => p.isLocal)?.identity;
  const watched = screenShares.find((s) => s.identity === watching) ?? null;
  const menuParticipant = participantMenu
    ? participants.find(
        (participant) => participant.identity === participantMenu.identity,
      )
    : undefined;
  const canAdjustMenuParticipant =
    menuParticipant != null &&
    (currentUserIsAdmin ||
      !senders[menuParticipant.identity]?.roles.includes("ADMIN"));
  const canOpenMenuParticipant =
    menuParticipant != null && canAdjustMenuParticipant;

  const canAdjustUserVolume = (identity: string) =>
    currentUserIsAdmin || !senders[identity]?.roles.includes("ADMIN");

  const sharerName = (identity: string) =>
    identity === localIdentity ? "You" : (senders[identity]?.name ?? "Someone");

  // Drop back to the tiles if whoever we were watching stopped sharing.
  useEffect(() => {
    if (watching && !screenShares.some((s) => s.identity === watching)) {
      watchScreenShareAudio(null);
      setWatching(null);
    }
  }, [screenShares, watching, watchScreenShareAudio]);

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
    watchScreenShareAudio(null);
    leave();
    onClose();
  }

  function watchShare(identity: string) {
    watchScreenShareAudio(identity);
    setWatching(identity);
  }

  function closeShare() {
    watchScreenShareAudio(null);
    setWatching(null);
  }

  function openParticipantMenu(identity: string, x: number, y: number) {
    setParticipantMenu({ identity, x, y });
  }

  function handleParticipantContextMenu(
    event: ReactMouseEvent<HTMLDivElement>,
    identity: string,
    canOpenMenu: boolean,
  ) {
    event.preventDefault();
    if (!canOpenMenu) return;
    openParticipantMenu(identity, event.clientX, event.clientY);
  }

  function resizeFromPointer(clientY: number) {
    const container = panelRef.current?.parentElement;
    const resizeStart = resizeStartRef.current;

    if (!container || !resizeStart) return;

    const bounds = container.getBoundingClientRect();

    if (bounds.height === 0) return;

    const nextHeight =
      resizeStart.height +
      ((clientY - resizeStart.clientY) / bounds.height) * 100;

    setCallHeightPercent(Math.round(clampCallHeight(nextHeight)));
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    isResizingRef.current = true;
    resizeStartRef.current = {
      clientY: event.clientY,
      height: callHeightPercent,
    };
    setIsResizing(true);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isResizingRef.current) return;

    resizeFromPointer(event.clientY);
  }

  function finishResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isResizingRef.current = false;
    resizeStartRef.current = null;
    setIsResizing(false);
  }

  function handleResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    let nextHeight: number | null = null;

    switch (event.key) {
      case "ArrowUp":
        nextHeight = callHeightPercent - KEYBOARD_RESIZE_STEP_PERCENT;
        break;
      case "ArrowDown":
        nextHeight = callHeightPercent + KEYBOARD_RESIZE_STEP_PERCENT;
        break;
      case "Home":
        nextHeight = MIN_CALL_HEIGHT_PERCENT;
        break;
      case "End":
        nextHeight = MAX_CALL_HEIGHT_PERCENT;
        break;
      default:
        return;
    }

    event.preventDefault();
    setCallHeightPercent(clampCallHeight(nextHeight));
  }

  return (
    <div
      ref={panelRef}
      className="flex flex-shrink-0 flex-col bg-gradient-to-b from-content2 to-content1"
      style={{ height: `${callHeightPercent}%` }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4 pt-4">
        <div className="flex flex-shrink-0 items-center justify-between">
          <span className="text-tiny font-medium uppercase tracking-widest text-brand">
            {connecting
              ? "Connecting…"
              : reconnecting
                ? "Reconnecting…"
                : connected
                  ? formatElapsed(elapsed)
                  : "Call"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              aria-label="Call settings"
              size="sm"
              variant="light"
              onPress={() => setSettingsOpen(true)}
            >
              <Icon name="settings" size={16} />
            </Button>
            <Button isIconOnly size="sm" variant="light" onPress={handleClose}>
              <Icon name="close" size={16} />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {error && (
            <div
              className="rounded-medium bg-danger/15 px-3 py-2 text-tiny text-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* The watched stage consumes the available middle space so resizing
              the divider resizes the preview instead of clipping it. */}
          {watched ? (
            <div className="min-h-0 flex-1">
              <ScreenShareStage
                key={watched.identity}
                name={sharerName(watched.identity)}
                share={watched}
                volume={watched.audioVolume}
                canAdjustVolume={canAdjustUserVolume(watched.identity)}
                onVolumeChange={(volume) =>
                  setScreenShareVolume(watched.identity, volume)
                }
                onClose={closeShare}
              />
            </div>
          ) : (
            screenShares.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3">
                {screenShares.map((share) => (
                  <ScreenShareTile
                    key={share.identity}
                    name={sharerName(share.identity)}
                    share={share}
                    onWatch={() => watchShare(share.identity)}
                  />
                ))}
              </div>
            )
          )}

          {screenShares.map((share) => (
            <ScreenShareAudio
              key={`audio-${share.identity}`}
              enabled={watching === share.identity}
              track={share.audioTrack}
              volume={share.audioVolume}
            />
          ))}

          <div className="flex min-h-[72px] min-w-0 flex-1 flex-wrap items-center justify-center gap-4">
            {participants.map((p) => {
              const sender = senders[p.identity];
              const name = p.isLocal ? "You" : (sender?.name ?? "Unknown");
              const isAdmin = sender?.roles.includes("ADMIN") ?? false;
              const canAdjustVolume =
                !p.isLocal && (currentUserIsAdmin || !isAdmin);
              const canOpenMenu = !p.isLocal && canAdjustVolume;

              return (
                <div
                  key={p.identity}
                  aria-label={
                    canOpenMenu ? `${name} participant options` : undefined
                  }
                  aria-haspopup={canOpenMenu ? "dialog" : undefined}
                  className={`flex flex-col items-center gap-1.5 rounded-medium outline-none ${
                    canOpenMenu
                      ? "cursor-context-menu focus-visible:ring-2 focus-visible:ring-brand"
                      : ""
                  }`}
                  role={canOpenMenu ? "button" : undefined}
                  tabIndex={canOpenMenu ? 0 : undefined}
                  onContextMenu={
                    p.isLocal
                      ? undefined
                      : (event) =>
                          handleParticipantContextMenu(
                            event,
                            p.identity,
                            canOpenMenu,
                          )
                  }
                  onKeyDown={
                    canOpenMenu
                      ? (event) => {
                          if (
                            event.key !== "ContextMenu" &&
                            !(event.shiftKey && event.key === "F10")
                          ) {
                            return;
                          }

                          event.preventDefault();
                          const bounds =
                            event.currentTarget.getBoundingClientRect();

                          openParticipantMenu(
                            p.identity,
                            bounds.left + bounds.width / 2,
                            bounds.top + bounds.height / 2,
                          );
                        }
                      : undefined
                  }
                >
                  <div
                    className={`rounded-full p-1 ${
                      p.isSpeaking ? "ring-2 ring-danger" : ""
                    } relative`}
                  >
                    <Avatar
                      className="bg-brand text-white"
                      name={name.charAt(0).toUpperCase()}
                      size="lg"
                      src={sender?.avatarUrl ?? undefined}
                    />
                    {!p.isLocal && p.volume === 0 && (
                      <span
                        aria-label={`${name} is muted locally`}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white ring-2 ring-content1"
                        title="Muted for you"
                      >
                        <Icon name="mic-off" size={11} />
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-tiny text-default-500">
                    {p.isMuted && <Icon name="mic-off" size={12} />}
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-center gap-3">
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

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {participantMenu &&
        menuParticipant &&
        !menuParticipant.isLocal &&
        canOpenMenuParticipant && (
          <ParticipantVolumeMenu
            name={senders[menuParticipant.identity]?.name ?? "Unknown"}
            showLocalControls={canAdjustMenuParticipant}
            volume={menuParticipant.volume}
            x={participantMenu.x}
            y={participantMenu.y}
            onChange={(volume) =>
              setParticipantVolume(menuParticipant.identity, volume)
            }
            onToggleMute={() => toggleParticipantMute(menuParticipant.identity)}
            onClose={() => setParticipantMenu(null)}
          />
        )}

      <div
        aria-label="Resize call panel"
        aria-orientation="horizontal"
        aria-valuemax={MAX_CALL_HEIGHT_PERCENT}
        aria-valuemin={MIN_CALL_HEIGHT_PERCENT}
        aria-valuenow={callHeightPercent}
        className={`flex h-3 flex-shrink-0 touch-none cursor-row-resize items-center justify-center border-b border-divider outline-none transition-colors hover:bg-default-100 focus-visible:bg-default-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
          isResizing ? "bg-default-100" : ""
        }`}
        role="separator"
        tabIndex={0}
        onKeyDown={handleResizeKeyDown}
        onPointerCancel={finishResize}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={finishResize}
      >
        <span className="h-1 w-12 rounded-full bg-default-400" />
      </div>
    </div>
  );
}
