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
  /** Creates a group (name + up to 14 other members) and navigates to it. */
  createGroup: (name: string, members: PlatformUser[]) => Promise<boolean>;
  /** Adds one member to an existing group. Returns false on failure (full, etc). */
  addMember: (conversationId: string, user: PlatformUser) => Promise<boolean>;
  /** Creator-only: removes a member from a group. Returns false on failure. */
  removeMember: (conversationId: string, userId: string) => Promise<boolean>;
  /** Creator-only: deletes a group entirely and navigates back to /sms. */
  deleteGroup: (conversationId: string) => Promise<boolean>;
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
  const {
    conversations,
    isLoading,
    addConversation,
    addMemberToConversation,
    removeMemberFromConversation,
    removeConversation,
    markRead,
  } = useConversations(userId);

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

  const createGroup = useCallback(
    async (name: string, members: PlatformUser[]) => {
      try {
        const res = await fetch("/api/chat/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupName: name,
            memberIds: members.map((m) => m.id),
          }),
        });

        if (!res.ok) return false;
        const conversation: Conversation = await res.json();

        // Seed the members from what we already know so the list/thread show
        // names and avatars immediately instead of waiting on a refetch.
        addConversation({
          ...conversation,
          members: members.map((m) => ({
            id: m.id,
            username: m.username,
            avatarUrl: m.avatarUrl,
          })),
        });
        router.push(`/sms/${conversation.id}`);

        return true;
      } catch {
        return false;
      }
    },
    [addConversation, router],
  );

  const addMember = useCallback(
    async (conversationId: string, user: PlatformUser) => {
      try {
        const res = await fetch(`/api/chat/${conversationId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId: user.id }),
        });

        if (!res.ok) return false;

        addMemberToConversation(conversationId, {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
        });

        return true;
      } catch {
        return false;
      }
    },
    [addMemberToConversation],
  );

  const removeMember = useCallback(
    async (conversationId: string, userId: string) => {
      try {
        const res = await fetch(
          `/api/chat/${conversationId}/members/${userId}`,
          { method: "DELETE" },
        );

        if (!res.ok) return false;
        removeMemberFromConversation(conversationId, userId);

        return true;
      } catch {
        return false;
      }
    },
    [removeMemberFromConversation],
  );

  const deleteGroup = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/chat/${conversationId}`, {
          method: "DELETE",
        });

        if (!res.ok) return false;
        removeConversation(conversationId);
        router.push("/sms");

        return true;
      } catch {
        return false;
      }
    },
    [removeConversation, router],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      conversations,
      isLoading,
      markRead,
      startConversation,
      createGroup,
      addMember,
      removeMember,
      deleteGroup,
      account: { userId, username, avatarUrl },
    }),
    [
      conversations,
      isLoading,
      markRead,
      startConversation,
      createGroup,
      addMember,
      removeMember,
      deleteGroup,
      userId,
      username,
      avatarUrl,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);

  if (!ctx) throw new Error("useChat must be used within a ChatProvider");

  return ctx;
}
