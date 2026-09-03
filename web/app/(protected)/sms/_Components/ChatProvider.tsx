"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { useConversations } from "./_Chat/useConversations";
import { IncomingCallModal } from "./_Call/IncomingCallModal";

import { useAccount } from "@/lib/use-account";
import { conversationName, type Conversation } from "@/lib/chat";
import { useRealtime } from "@/lib/useRealtime";
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
  /**
   * Conversation whose call this user is currently in, if any. Set by
   * ConversationView so the incoming-call prompt can skip anyone already
   * sitting in that call (they'd otherwise be asked to join a call they're
   * already on every time another member joins).
   */
  setActiveCall: (conversationId: string | null) => void;
  account: {
    userId: string | null;
    username: string | null;
    avatarUrl: string | null;
    roles: string[];
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
  const { subscribe } = useRealtime();
  const { userId, username, avatarUrl, roles } = useAccount();
  const {
    conversations,
    isLoading,
    addConversation,
    addMemberToConversation,
    removeMemberFromConversation,
    removeConversation,
    markRead,
  } = useConversations(userId);

  /** Conversation id of the call being offered to us right now, if any. */
  const [incomingCallId, setIncomingCallId] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  // Read inside the CALL_STARTED subscription without making it tear down and
  // resubscribe every time a call starts or ends.
  const activeCallIdRef = useRef(activeCallId);

  useEffect(() => {
    activeCallIdRef.current = activeCallId;
  }, [activeCallId]);

  const setActiveCall = useCallback((conversationId: string | null) => {
    setActiveCallId(conversationId);
    // Joining a call answers its own prompt.
    if (conversationId) {
      setIncomingCallId((prev) => (prev === conversationId ? null : prev));
    }
  }, []);

  // Incoming call: prompt every other member of the conversation. Note this
  // deliberately does NOT skip people already viewing that thread -- they're
  // reading messages, not in the call, and would otherwise get no indication
  // at all that a call had started.
  useEffect(() => {
    const offStarted = subscribe("CALL_STARTED", (event) => {
      if (event.senderId === userId) return;
      // Already sitting in this call -- every later joiner emits CALL_STARTED
      // too, and we don't want to prompt someone to join what they're on.
      if (activeCallIdRef.current === event.conversationId) return;

      setIncomingCallId(event.conversationId);
    });

    const offEnded = subscribe("CALL_ENDED", (event) => {
      // The caller hung up before we answered -- drop the prompt.
      setIncomingCallId((prev) => (prev === event.conversationId ? null : prev));
    });

    return () => {
      offStarted();
      offEnded();
    };
  }, [subscribe, userId]);

  const incomingConversation = incomingCallId
    ? conversations.find((c) => c.id === incomingCallId)
    : undefined;

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
            {
              id: user.id,
              username: user.username,
              avatarUrl: user.avatarUrl,
              roles: user.roles,
            },
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
            roles: m.roles,
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
          roles: user.roles,
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
      setActiveCall,
      account: { userId, username, avatarUrl, roles },
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
      setActiveCall,
      userId,
      username,
      avatarUrl,
      roles,
    ],
  );

  return (
    <ChatContext.Provider value={value}>
      {children}

      <IncomingCallModal
        avatarUrl={incomingConversation?.members[0]?.avatarUrl}
        isOpen={incomingCallId !== null}
        title={
          incomingConversation
            ? conversationName(incomingConversation)
            : "Incoming call"
        }
        onAccept={() => {
          // ?call=1 tells ConversationView to open straight into the call
          // rather than just the thread.
          router.push(`/sms/${incomingCallId}?call=1`);
          setIncomingCallId(null);
        }}
        onDecline={() => setIncomingCallId(null)}
      />
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);

  if (!ctx) throw new Error("useChat must be used within a ChatProvider");

  return ctx;
}
