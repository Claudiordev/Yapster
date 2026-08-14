"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { useConversations } from "./_Chat/useConversations";

import { useAccount } from "@/lib/use-account";
import type { Conversation } from "@/lib/chat";
import type { PlatformUser } from "@/app/api/users/search/route";

interface ChatContextValue {
  conversations: Conversation[];
  isLoading: boolean;
  markRead: (conversationId: string) => void;
  startConversation: (user: PlatformUser) => Promise<void>;
  account: {
    userId: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Shares the conversation list, read state, and current account across the chat
 * layout (sidebar) and the routed thread/main panels, so navigating between
 * conversations doesn't re-fetch the list or drop the socket.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { userId, username, avatarUrl } = useAccount();
  const { conversations, isLoading, addConversation, markRead } =
    useConversations(userId);

  const startConversation = useCallback(
    async (user: PlatformUser) => {
      try {
        const res = await fetch("/api/chat/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientUserId: user.id }),
        });

        if (!res.ok) return;
        const conversation: Conversation = await res.json();

        // Seed the peer from the searched user so the name/avatar show at once.
        addConversation({
          ...conversation,
          members: [
            { id: user.id, username: user.username, avatarUrl: user.avatarUrl },
          ],
        });
        router.push(`/sms/${conversation.id}`);
      } catch {
        // ignore — failed to start conversation
      }
    },
    [addConversation, router],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      isLoading,
      markRead,
      startConversation,
      account: { userId, username, avatarUrl },
    }),
    [conversations, isLoading, markRead, startConversation, userId, username, avatarUrl],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);

  if (!ctx) throw new Error("useChat must be used within a ChatProvider");

  return ctx;
}
