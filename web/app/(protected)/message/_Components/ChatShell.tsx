"use client";

import { useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { addToast } from "@heroui/toast";

import { ChatList } from "./_Chat/ChatList";
import { ChatNav } from "./_Chat/ChatNav";
import { ChatProfile } from "./_Chat/ChatProfile";
import { useChat } from "./ChatProvider";
import { EventsPanel } from "./_Events/EventsPanel";
import { GameServersPanel } from "./_GameServers/GameServersPanel";
import { PremiumPanel } from "./_Premium/PremiumPanel";
import { type PanelKey } from "./_Panels/utils/panels";

/**
 * Persistent chat frame: the left sidebar (nav + conversation list + profile)
 * stays mounted while the routed panel — Main or a conversation — renders on the
 * right. Selecting a conversation just navigates; the socket/list don't remount.
 */
export function ChatShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const {
    conversations,
    isLoading,
    markRead,
    leaveGroup,
    deleteGroup,
    account,
  } = useChat();

  const report = async (action: Promise<{ ok: boolean; detail?: string }>) => {
    const result = await action;

    if (!result.ok)
      addToast({
        title: result.detail ?? "Something went wrong",
        color: "danger",
      });
  };
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  return (
    <div className="flex flex-row flex-grow min-h-0 text-foreground overflow-hidden">
      <div className="w-80 flex-shrink-0 flex flex-col min-h-0 bg-content1 dark:bg-surface-sidebar">
        <ChatNav activePanel={activePanel} onSelectPanel={setActivePanel} />

        <div className="h-px bg-divider" />

        <ChatList
          activeConversationId={params.conversationId ?? null}
          conversations={conversations}
          currentUserId={account.userId}
          isLoading={isLoading}
          onDeleteGroup={(id) => void report(deleteGroup(id))}
          onLeaveGroup={(id) => void report(leaveGroup(id))}
          onMarkRead={markRead}
          onNewChat={() => router.push("/message")}
          onSelect={(id) => router.push(`/message/${id}`)}
        />

        <ChatProfile />
      </div>

      <div className="w-px flex-shrink-0 bg-default-200 dark:bg-surface-border" />

      <div className="relative flex flex-col flex-grow min-h-0">
        {children}

        {activePanel === "game-servers" && (
          <GameServersPanel onClose={() => setActivePanel(null)} />
        )}

        {activePanel === "events" && (
          <EventsPanel onClose={() => setActivePanel(null)} />
        )}

        {activePanel === "premium" && (
          <PremiumPanel onClose={() => setActivePanel(null)} />
        )}
      </div>
    </div>
  );
}
