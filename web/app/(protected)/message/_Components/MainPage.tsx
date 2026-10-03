"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

import { Icon } from "@/components/Icon/Icon";

import { NewGroupModal } from "./_Chat/NewGroupModal";
import { UserSearch } from "./_Chat/UserSearch";
import { useChat } from "./ChatProvider";

/** The "Main" home panel shown at /message when no conversation is open. */
export function MainPage() {
  const { startConversation, createGroup } = useChat();
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  return (
    <div className="flex flex-col flex-grow min-h-0 bg-background dark:bg-surface-chat">
      <div className="flex-shrink-0 flex items-center px-4 h-14 border-b border-divider shadow-sm">
        <h2 className="font-semibold text-foreground">Main</h2>
      </div>

      <div className="flex-grow overflow-y-auto flex flex-col items-center justify-center p-6">
        <div className="start-card w-full max-w-[470px] px-6 py-8 text-center sm:px-9">
          <h1 className="mb-7 text-[27px] font-bold leading-tight tracking-tight text-foreground">
            Start a conversation.
          </h1>

          <UserSearch onStartConversation={startConversation} />

          <div className="my-5 flex items-center gap-3 text-xs text-default-400">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            className="btn-coral min-h-[45px] w-full rounded-[10px] text-sm font-bold"
            startContent={<Icon name="users" size={16} />}
            onPress={() => setGroupModalOpen(true)}
          >
            Create a group
          </Button>
        </div>

        <p className="mt-7 text-sm text-default-400">
          Your people. Your space.{" "}
          <span className="text-default-600">Your voice.</span>
        </p>
      </div>

      <NewGroupModal
        isOpen={groupModalOpen}
        onClose={() => setGroupModalOpen(false)}
        onCreate={createGroup}
      />
    </div>
  );
}
