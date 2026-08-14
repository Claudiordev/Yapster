"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Conversation, UserStatus } from "@/lib/chat";
import { useRealtime } from "@/lib/useRealtime";

/** Most-recent first; conversations with no messages sink to the bottom. */
function byRecent(a: Conversation, b: Conversation): number {
  return (
    new Date(b.lastMessageAt ?? 0).getTime() -
    new Date(a.lastMessageAt ?? 0).getTime()
  );
}

/**
 * Loads the logged-in user's conversations (the left list) from the chat
 * service — each carries its last-message preview and read cursor. `markRead`
 * clears a conversation's unread state; `addConversation` inserts a just-started
 * DM without a refetch.
 */
export function useConversations(myUserId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // Only the first load shows the skeleton; background refreshes (incoming
  // messages) must not flash it.
  const [isLoading, setIsLoading] = useState(true);
  const { subscribe } = useRealtime();
  const conversationsRef = useRef<Conversation[]>([]);
  const myUserIdRef = useRef(myUserId);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");

      if (res.ok) {
        const list: Conversation[] = await res.json();

        setConversations([...list].sort(byRecent));
      }
    } catch {
      // ignore — empty until the backend is reachable
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Presence: a peer changed status (or came online / went offline). Patch that
  // member wherever they appear — someone can be in several conversations, so
  // this updates every row they're a member of, not just one.
  useEffect(() => {
    return subscribe("USER_STATUS_EVENT", (event) => {
      const next = event.userStatusType.toLowerCase() as UserStatus;

      setConversations((prev) =>
        prev.map((c) =>
          c.members.some((m) => m.id === event.userId)
            ? {
                ...c,
                members: c.members.map((m) =>
                  m.id === event.userId ? { ...m, status: next } : m,
                ),
              }
            : c,
        ),
      );
    });
  }, [subscribe]);

  // Live messages update the matching row in place: preview, ordering, and the
  // unread count bumped in realtime (only for messages from others; my own
  // sends aren't unread). An unknown conversation → pull it (with its count).
  useEffect(() => {
    return subscribe("MESSAGE", (event) => {
      if (!conversationsRef.current.some((c) => c.id === event.roomId)) {
        refresh();

        return;
      }

      const fromMe = event.senderId === myUserIdRef.current;

      setConversations((prev) =>
        [...prev]
          .map((c) =>
            c.id === event.roomId
              ? {
                  ...c,
                  lastMessage: event.body,
                  lastMessageAt: event.sentAt,
                  lastMessageSeq: event.seq,
                  unreadCount: fromMe ? c.unreadCount : c.unreadCount + 1,
                }
              : c,
          )
          .sort(byRecent),
      );
    });
  }, [subscribe, refresh]);

  const addConversation = useCallback((conversation: Partial<Conversation>) => {
    setConversations((prev) => {
      if (prev.some((c) => c.id === conversation.id)) return prev;

      // `/dm` returns only { id, type, name } — fill the summary fields it omits.
      const full: Conversation = {
        members: [],
        lastMessage: null,
        lastMessageAt: null,
        lastMessageSeq: null,
        lastReadSeq: 0,
        unreadCount: 0,
        name: null,
        type: "DM",
        ...conversation,
        id: conversation.id!,
      };

      return [full, ...prev];
    });
  }, []);

  /**
   *
   * Updates the conversation to read after active
   */
  const markRead = useCallback((conversationId: string) => {
    const convo = conversationsRef.current.find((c) => c.id === conversationId);

    if (!convo || convo.lastMessageSeq == null) return;

    if (convo.lastReadSeq >= convo.lastMessageSeq) return; // already read

    const seq = convo.lastMessageSeq;

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, lastReadSeq: seq, unreadCount: 0 } : c,
      ),
    );

    fetch(`/api/chat/${conversationId}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ seq }),
    }).catch(() => {});
  }, []);

  return { conversations, isLoading, refresh, addConversation, markRead };
}
