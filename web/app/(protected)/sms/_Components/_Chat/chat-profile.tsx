"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";

import { AvatarUploadModal } from "@/components/avatar-upload-modal";
import { Icon } from "@/components/icon";
import { useAccount } from "@/lib/use-account";

export function ChatProfile() {
  const { username, balance, avatarUrl } = useAccount();
  const [avatarOpen, setAvatarOpen] = useState(false);

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
        <p className="text-xs text-default-500 leading-tight">Signed in as</p>
        <p className="text-sm font-semibold text-foreground truncate">
          {username ?? "…"}
        </p>
      </div>

      <div className="flex-grow" />

      <div className="flex flex-shrink-0 items-center gap-1 text-white">
        <Icon name="dollar" size={16} />
        <span className="text-sm font-semibold tabular-nums">
          {balance != null ? balance.toLocaleString() : "…"}
        </span>
      </div>

      <AvatarUploadModal
        isOpen={avatarOpen}
        onClose={() => setAvatarOpen(false)}
      />
    </div>
  );
}
