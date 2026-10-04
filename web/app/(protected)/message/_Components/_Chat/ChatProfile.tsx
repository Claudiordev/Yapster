"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";

import { ProfileModal } from "./ProfileModal";

import { Icon } from "@/components/Icon/Icon";
import { SettingsModal } from "@/components/SettingsModal/SettingsModal";
import type { SelectableStatus } from "@/types/chat";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";
import { useCallSession } from "../CallProvider";
import { useChat } from "../ChatProvider";
import { useAccount } from "@/lib/hooks/useAccount";

/** The statuses a user may pick. OFFLINE is derived from the socket, never chosen. */
const CHOICES: { key: SelectableStatus; dot: string; label: string }[] = [
  { key: "ONLINE", dot: "bg-success", label: "Online" },
  { key: "BUSY", dot: "bg-danger", label: "Busy" },
  { key: "IDLE", dot: "bg-warning", label: "Idle" },
];

/** Shown instead of the choice while the socket is down — nothing to announce. */
const DISCONNECTED = { dot: "bg-default-300", label: "Offline" };

export function ChatProfile() {
  const { username, avatarUrl } = useAccount();
  const { myStatus, chooseStatus: choose, isConnected } = useChat();
  const {
    callConversationId,
    leaveCall,
    connected,
    muted,
    deafened,
    toggleMute,
    toggleDeafen,
  } = useCallSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const current = CHOICES.find((c) => c.key === myStatus) ?? CHOICES[0];

  return (
    <div className="chat-profile-card mx-3 mb-3 flex flex-shrink-0 items-center gap-3 px-3 py-3">
      <button
        aria-label="Edit profile"
        className="group relative flex-shrink-0 rounded-full"
        type="button"
        onClick={() => setProfileOpen(true)}
      >
        <Avatar
          className="bg-brand text-white ring-2 ring-brand/20"
          name={(username ?? "U").charAt(0).toUpperCase()}
          size="md"
          src={avatarUrl ?? undefined}
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Icon name="edit" size={16} />
        </span>
      </button>

      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{username ?? "…"}</p>
        <Dropdown motionProps={POPUP_MOTION_PROPS} placement="top-start">
          <DropdownTrigger>
            <button
              aria-label="Change your status"
              className="flex items-center gap-1.5 text-xs text-default-500 leading-tight rounded-small hover:text-foreground transition-colors disabled:cursor-not-allowed"
              disabled={!isConnected}
              type="button"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? current.dot : DISCONNECTED.dot
                }`}
              />
              {isConnected ? current.label : DISCONNECTED.label}
            </button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Status"
            selectedKeys={[myStatus]}
            selectionMode="single"
            onAction={(key) => choose(key as SelectableStatus)}
          >
            {CHOICES.map((c) => (
              <DropdownItem
                key={c.key}
                startContent={
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                }
                textValue={c.label}
              >
                {c.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
      </div>

      <div className="flex-grow" />

      {/* While in a call: an end-call key, ahead of the voice keys, styled like its neighbours (same grey key, red-tinted icon) — leave from anywhere. */}
      {callConversationId && (
        <Button
          isIconOnly
          aria-label="Leave call"
          className="chat-profile-action chat-profile-logout min-w-9"
          disableAnimation
          radius="none"
          title="Leave call"
          variant="light"
          onPress={leaveCall}
        >
          <Icon className="rotate-[135deg]" name="phone" size={16} />
        </Button>
      )}

      {/* Mic and deafen, app-wide: they carry into calls and mirror the call while in one.
          Grey normally, red-tinted when on. */}
      <Button
        isIconOnly
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
        className={`chat-profile-action min-w-9 ${
          muted ? "chat-profile-logout" : "chat-profile-settings"
        }`}
        disableAnimation
        isDisabled={callConversationId !== null && !connected}
        radius="none"
        title={muted ? "Unmute" : "Mute"}
        variant="light"
        onPress={toggleMute}
      >
        <Icon name={muted ? "mic-off" : "mic"} size={16} />
      </Button>
      <Button
        isIconOnly
        aria-label={deafened ? "Undeafen" : "Deafen (stop all sound)"}
        aria-pressed={deafened}
        className={`chat-profile-action min-w-9 ${
          deafened ? "chat-profile-logout" : "chat-profile-settings"
        }`}
        disableAnimation
        isDisabled={callConversationId !== null && !connected}
        radius="none"
        title={deafened ? "Undeafen" : "Deafen: stop all sound"}
        variant="light"
        onPress={toggleDeafen}
      >
        <Icon name={deafened ? "headphones-off" : "headphones"} size={16} />
      </Button>

      <Button
        isIconOnly
        aria-label="Settings"
        className="chat-profile-action chat-profile-settings min-w-9"
        size="sm"
        variant="light"
        onPress={() => setSettingsOpen(true)}
      >
        <Icon name="settings" size={16} />
      </Button>

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
