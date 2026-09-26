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

import { formatElapsed } from "@/app/(protected)/message/_Components/_Call/utils/callUtils";
import { LatencyIndicator } from "./LatencyIndicator";
import { ParticipantVolumeMenu } from "./ParticipantVolumeMenu";
import { ScreenShareStage, ScreenShareTile } from "./ScreenShareView";
import { useCallSession } from "../CallProvider";

import { Icon } from "@/components/Icon/Icon";
import { RoleBadge } from "@/components/RoleBadge/RoleBadge";
import { SettingsModal } from "@/components/SettingsModal/SettingsModal";
import { badgesForRoles } from "@/lib/roleBadges";
import { useAccount } from "@/lib/hooks/useAccount";
import type { UserIdentity } from "@/types/user";

interface CallPanelProps {
  /** identity (userId) -> display name/avatar, same map ChatThread uses for senders. */
  senders: Record<string, UserIdentity>;
  isGroupCreator: boolean;
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
  senders,
  isGroupCreator,
}: CallPanelProps) {
  const { roles: accountRoles } = useAccount();
  const currentUserIsAdmin = accountRoles.includes("ADMIN");
  const canModerateCall = currentUserIsAdmin || isGroupCreator;
  const {
    connected,
    connecting,
    reconnecting,
    participants,
    muted,
    screenSharing,
    screenShares,
    error,
    callStartedAt,
    watching,
    watchShare,
    closeShare,
    leaveCall,
    toggleMute,
    toggleDeafen,
    deafened,
    toggleScreenShare,
    setParticipantVolume,
    toggleParticipantMute,
    muteParticipantForEveryone,
    setScreenShareVolume,
  } = useCallSession();

  const [now, setNow] = useState(() => Date.now());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [participantMenu, setParticipantMenu] = useState<{
    identity: string;
    x: number;
    y: number;
  } | null>(null);
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
    menuParticipant != null && (canAdjustMenuParticipant || canModerateCall);

  const canAdjustUserVolume = (identity: string) =>
    currentUserIsAdmin || !senders[identity]?.roles.includes("ADMIN");

  const sharerName = (identity: string) =>
    identity === localIdentity ? "You" : (senders[identity]?.name ?? "Someone");

  // Ticks the elapsed timer; the start time lives in the provider so the
  // count carries on even if this panel was closed while viewing another chat.
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(id);
  }, [connected]);

  const elapsed = callStartedAt ? Math.max(0, Math.floor((now - callStartedAt) / 1000)) : 0;

  function handleClose() {
    leaveCall();
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

  /**
   * One participant as a call tile: dark card with a soft tint, centered avatar,
   * and a blurred name pill bottom-left. Speaking lights the tile edge, the
   * avatar ring and a green dot on the pill. `compact` is the narrow column
   * shown next to a watched screen share.
   */
  // The column next to a watched screen share scales with who is in the call:
  // a lone participant gets a slim strip, and past six people it becomes two
  // columns instead of ever-taller tiles.
  const sideTiles = participants.length + Math.max(0, screenShares.length - 1);
  const sideColumns = sideTiles > 6 ? 2 : 1;
  const sideWidth =
    sideTiles <= 1
      ? "7.5rem"
      : sideTiles <= 3
        ? "9.5rem"
        : sideTiles <= 6
          ? "11rem"
          : "17rem";

  function renderParticipantTile(p: (typeof participants)[number], compact: boolean) {
    const avatarSize = compact && sideTiles > 3 ? "sm" : compact ? "md" : "lg";

    const sender = senders[p.identity];
    const name = p.isLocal ? "You" : (sender?.name ?? "Unknown");
    const isAdmin = sender?.roles.includes("ADMIN") ?? false;
    const roleBadges = badgesForRoles(sender?.roles);
    const canAdjustVolume = !p.isLocal && (currentUserIsAdmin || !isAdmin);
    const canOpenMenu = !p.isLocal && (canAdjustVolume || canModerateCall);

    return (
      <div
        key={p.identity}
        aria-label={canOpenMenu ? `${name} participant options` : undefined}
        aria-haspopup={canOpenMenu ? "dialog" : undefined}
        className={`relative w-full min-w-0 ${compact ? "aspect-[4/3] flex-shrink-0" : "h-full min-h-0"} overflow-hidden rounded-large border bg-content2 outline-none transition-[border-color,box-shadow] duration-150 ${
          p.isSpeaking
            ? "border-success/60 shadow-[0_0_0_1px_rgba(97,217,139,0.25),0_0_18px_rgba(97,217,139,0.18)]"
            : "border-white/10"
        } ${
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
                handleParticipantContextMenu(event, p.identity, canOpenMenu)
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
                const bounds = event.currentTarget.getBoundingClientRect();

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
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(181,140,255,0.13),transparent_42%)]"
        />

        <div className={`absolute inset-0 grid place-items-center ${compact ? "pb-5" : ""}`}>
          <div
            className={`relative rounded-full p-1 ${
              p.isSpeaking ? "ring-2 ring-success" : ""
            }`}
          >
            <Avatar
              className="bg-brand text-white"
              name={name.charAt(0).toUpperCase()}
              size={avatarSize}
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
            {roleBadges.length > 0 && (
              <span className="absolute -right-2 -bottom-1 z-[1] flex flex-col items-end gap-1">
                {roleBadges.map((badge) => (
                  <RoleBadge key={badge.role} badge={badge} ownerName={name} />
                ))}
              </span>
            )}
          </div>
        </div>

        <span className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-small border border-white/10 bg-black/70 px-2 py-1 text-tiny font-bold text-white backdrop-blur-sm">
          {p.isMuted && <Icon name="mic-off" size={12} />}
          <span className="truncate">{name}</span>
          {p.isSpeaking && (
            <i
              aria-label="Speaking"
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success shadow-[0_0_0_2px_rgba(97,217,139,0.25)]"
            />
          )}
        </span>
      </div>
    );
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
            {/* Mounted only while connected, so probing starts/stops with the call. */}
            {connected && <LatencyIndicator />}
            <Button
              isIconOnly
              aria-label="Call settings"
              className="call-control"
              disableAnimation
              radius="none"
              variant="light"
              onPress={() => setSettingsOpen(true)}
            >
              <Icon name="settings" size={16} />
            </Button>
            <Button
              isIconOnly
              aria-label="Close call panel"
              className="call-control"
              disableAnimation
              radius="none"
              variant="light"
              onPress={handleClose}
            >
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

          {/* Showcase layout: while someone's screen is watched, the stage takes the
              big left tile and everyone else stacks as tiles on the right; with
              no watched share it's a grid of tiles. The stage consumes the
              available space so resizing the divider resizes it, not clips it. */}
          {watched ? (
            <div className="flex min-h-0 flex-1 gap-2">
              <div className="min-h-0 min-w-0 flex-1">
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
              <div
                className={`min-h-0 max-w-[40%] flex-shrink-0 content-start gap-2 overflow-y-auto ${
                  sideColumns === 2 ? "grid grid-cols-2" : "flex flex-col"
                }`}
                style={{ width: sideWidth }}
              >
                {/* Other people's shares stay one click away while one is open. */}
                {screenShares
                  .filter((share) => share.identity !== watched.identity)
                  .map((share) => (
                    <ScreenShareTile
                      key={share.identity}
                      compact
                      name={sharerName(share.identity)}
                      share={share}
                      onWatch={() => watchShare(share.identity)}
                    />
                  ))}
                {participants.map((p) => renderParticipantTile(p, true))}
              </div>
            </div>
          ) : (
            <>
              <div
                className="grid min-h-0 min-w-0 flex-1 gap-2"
                style={{
                  // Tiles stretch to fill the panel. Rows share the available
                  // height (down to a minimum), so a lone participant fills it
                  // exactly with no scrollbar; only when the rows can't fit at
                  // the minimum height does the panel scroll.
                  gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
                  gridAutoRows: "minmax(7rem, 1fr)",
                }}
              >
                {/* A share is a tile in the same grid, with a play button. */}
                {screenShares.map((share) => (
                  <ScreenShareTile
                    key={share.identity}
                    name={sharerName(share.identity)}
                    share={share}
                    onWatch={() => watchShare(share.identity)}
                  />
                ))}
                {participants.map((p) => renderParticipantTile(p, false))}
              </div>
            </>
          )}

        </div>

        {/* Same raised key-cap buttons as the showcase call preview
            (.call-control in globals.css): muted/deafened = red fill, sharing =
            wine "pressed" state, leave = red end button. */}
        <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-white/5 pt-3">
          <Button
            isIconOnly
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
            className={`call-control ${muted ? "call-control--off" : ""}`}
            disableAnimation
            isDisabled={!connected}
            radius="none"
            variant="light"
            onPress={toggleMute}
          >
            <Icon name={muted ? "mic-off" : "mic"} size={16} />
          </Button>

          <Button
            isIconOnly
            aria-label={deafened ? "Undeafen" : "Deafen (stop all sound)"}
            aria-pressed={deafened}
            className={`call-control ${deafened ? "call-control--off" : ""}`}
            disableAnimation
            isDisabled={!connected}
            radius="none"
            title={deafened ? "Undeafen" : "Deafen: stop all sound"}
            variant="light"
            onPress={toggleDeafen}
          >
            <Icon name={deafened ? "headphones-off" : "headphones"} size={16} />
          </Button>

          <Button
            isIconOnly
            aria-label={screenSharing ? "Stop sharing screen" : "Share screen"}
            aria-pressed={screenSharing}
            className={`call-control ${screenSharing ? "call-control--active" : ""}`}
            disableAnimation
            isDisabled={!connected}
            radius="none"
            variant="light"
            onPress={toggleScreenShare}
          >
            <Icon name="screen-share" size={16} />
          </Button>

          <Button
            isIconOnly
            aria-label="Leave call"
            className="call-control call-control--end"
            disableAnimation
            radius="none"
            variant="light"
            onPress={handleClose}
          >
            <Icon className="rotate-[135deg]" name="phone" size={16} />
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
            canMuteForEveryone={canModerateCall}
            isMutedForEveryone={menuParticipant.isMuted}
            name={senders[menuParticipant.identity]?.name ?? "Unknown"}
            showLocalControls={canAdjustMenuParticipant}
            volume={menuParticipant.volume}
            x={participantMenu.x}
            y={participantMenu.y}
            onChange={(volume) =>
              setParticipantVolume(menuParticipant.identity, volume)
            }
            onToggleMute={() => toggleParticipantMute(menuParticipant.identity)}
            onMuteForEveryone={async () => {
              if (await muteParticipantForEveryone(menuParticipant.identity)) {
                setParticipantMenu(null);
              }
            }}
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
