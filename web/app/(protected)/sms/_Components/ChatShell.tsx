"use client";

import { useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";

import { ChatList } from "./_Chat/ChatList";
import { ChatNav } from "./_Chat/ChatNav";
import { ChatProfile } from "./_Chat/ChatProfile";
import { useChat } from "./ChatProvider";
import { GameServersPanel } from "./_GameServers/GameServersPanel";
import { type PanelKey } from "./_Panels/panels";

import { EventsPage } from "@/app/(protected)/events/_Components/EventsPage";
import { PremiumPage } from "@/app/(protected)/premium/_Components/PremiumPage";

/**
 * Persistent chat frame: the left sidebar (nav + conversation list + profile)
 * stays mounted while the routed panel — Main or a conversation — renders on the
 * right. Selecting a conversation just navigates; the socket/list don't remount.
 */
export function ChatShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const { conversations, isLoading } = useChat();
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  return (
    <div className="flex flex-row flex-grow min-h-0 text-foreground overflow-hidden">
      <div className="w-80 flex-shrink-0 flex flex-col min-h-0 bg-content1 dark:bg-surface-sidebar">
        <ChatNav activePanel={activePanel} onSelectPanel={setActivePanel} />

        <div className="h-px bg-divider" />

        <ChatList
          activeConversationId={params.conversationId ?? null}
          conversations={conversations}
          isLoading={isLoading}
          onNewChat={() => router.push("/sms")}
          onSelect={(id) => router.push(`/sms/${id}`)}
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
          <div className="absolute inset-0 z-20 flex flex-col">
            <EventsPage onClose={() => setActivePanel(null)} />
          </div>
        )}

        {activePanel === "premium" && (
          <div className="absolute inset-0 z-20 flex flex-col">
            <PremiumPage onClose={() => setActivePanel(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
