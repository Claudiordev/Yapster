"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/dropdown";

import { AvatarUploadModal } from "@/components/AvatarUploadModal";
import { useMyStatus } from "./useMyStatus";

import { Icon } from "@/components/icon";
import type { SelectableStatus } from "@/lib/chat";
import { useAccount } from "@/lib/use-account";

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
  const { myStatus, choose, isConnected } = useMyStatus();
  const [avatarOpen, setAvatarOpen] = useState(false);

  const current = CHOICES.find((c) => c.key === myStatus) ?? CHOICES[0];

  return (
    <div className="flex-shrink-0 mx-3 mb-3 flex items-center gap-3 px-3 py-3 rounded-large bg-content2 shadow-lg shadow-black/30">
      <button
        aria-label="Change avatar"
        className="group relative flex-shrink-0 rounded-full"
        type="button"
        onClick={() => setAvatarOpen(true)}
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
        <Dropdown placement="top-start">
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

      <AvatarUploadModal
        isOpen={avatarOpen}
        onClose={() => setAvatarOpen(false)}
      />
    </div>
  );
}
