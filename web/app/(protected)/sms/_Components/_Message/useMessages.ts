"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { randomId } from "@/lib/randomId";
import { useRealtime } from "@/lib/useRealtime";
import type { ChatMessageDto } from "@/lib/chat";

export interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  sentAt: number;
  seq: number; // server order stamp; optimistic sends use PENDING_SEQ until saved
  fromMe: boolean;
  pending?: boolean;
}

type Page = ThreadMessage[];
type MessagesData = InfiniteData<Page, number | undefined>;

const PAGE_SIZE = 20;
// Optimistic/unsent messages sort as the newest and never become the paging
// cursor (which is the *oldest* loaded seq).
const PENDING_SEQ = Number.MAX_SAFE_INTEGER;

const messagesKey = (conversationId: string | null, myUserId: string | null) =>
  ["messages", conversationId, myUserId] as const;

function toThreadMessage(m: ChatMessageDto, myUserId: string | null): ThreadMessage {
  return {
    id: m.id,
    body: m.body,
    senderId: m.senderId,
    sentAt: new Date(m.sentAt).getTime(),
    seq: m.seq,
    fromMe: m.senderId === myUserId,
  };
}

/**
 * Messages for the active conversation, cached by TanStack Query so re-opening
 * a chat is instant (stale-while-revalidate). History is keyset-paged by `seq`
 * (`loadMore` pulls older pages); live socket messages and optimistic sends are
 * written straight into the same query cache.
 */
export function useMessages(
  conversationId: string | null,
  myUserId: string | null,
) {
  const [isSending, setIsSending] = useState(false);
  const { subscribe } = useRealtime();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: messagesKey(conversationId, myUserId),
    enabled: conversationId !== null,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!conversationId) return [];

      const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });

      if (pageParam != null) qs.set("beforeSeq", String(pageParam));

      const res = await fetch(`/api/chat/${conversationId}/message?${qs}`);

      if (!res.ok) return [];

      // Server returns newest-first; keep as-is (we sort for display).
      const dtos: ChatMessageDto[] = await res.json();

      return dtos.map((m) => toThreadMessage(m, myUserId));
    },
    // A full page means there may be older messages; fewer = start of history.
    getNextPageParam: (lastPage) =>
      lastPage.length === PAGE_SIZE
        ? Math.min(...lastPage.map((m) => m.seq))
        : undefined,
  });

  // Flatten pages → chronological, de-duped by id.
  const messages = useMemo(() => {
    const byId = new Map<string, ThreadMessage>();

    for (const page of data?.pages ?? []) {
      for (const m of page) byId.set(m.id, m);
    }

    return Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
  }, [data]);

  const loadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  // Live messages for the active conversation → write into its query cache.
  useEffect(() => {
    if (!conversationId) return;

    return subscribe("MESSAGE", (event) => {
      if (event.roomId !== conversationId) return;

      const sentAt = new Date(event.sentAt).getTime();

      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId, myUserId),
        (old) => {
          if (!old) return old;

          // Already have it by server id → echo of our own send, or redelivery.
          if (old.pages.some((p) => p.some((m) => m.id === event.id))) return old;

          // Our own message echoed back before the POST reconciled the optimistic
          // bubble → adopt the server id/seq instead of adding a second bubble.
          if (event.senderId === myUserId) {
            for (let pi = 0; pi < old.pages.length; pi++) {
              const idx = old.pages[pi].findIndex(
                (m) => m.pending && m.fromMe && m.body === event.body,
              );

              if (idx !== -1) {
                const pages = old.pages.map((p) => p.slice());

                pages[pi][idx] = {
                  ...pages[pi][idx],
                  id: event.id,
                  seq: event.seq,
                  sentAt,
                  pending: false,
                };

                return { ...old, pages };
              }
            }
          }

          const msg: ThreadMessage = {
            id: event.id,
            body: event.body,
            senderId: event.senderId,
            sentAt,
            seq: event.seq,
            fromMe: event.senderId === myUserId,
          };

          // Newest page is index 0; position within a page doesn't matter (we sort).
          const pages = old.pages.map((p, i) => (i === 0 ? [msg, ...p] : p));

          return { ...old, pages };
        },
      );
    });
  }, [conversationId, myUserId, subscribe, queryClient]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!conversationId) return;

      const key = messagesKey(conversationId, myUserId);
      const tempId = randomId();
      const optimistic: ThreadMessage = {
        id: tempId,
        body,
        senderId: myUserId ?? "",
        sentAt: Date.now(),
        seq: PENDING_SEQ,
        fromMe: true,
        pending: true,
      };

      queryClient.setQueryData<MessagesData>(key, (old) => {
        if (!old || old.pages.length === 0) {
          return { pages: [[optimistic]], pageParams: [undefined] };
        }

        const pages = old.pages.map((p, i) => (i === 0 ? [optimistic, ...p] : p));

        return { ...old, pages };
      });
      setIsSending(true);

      const clearPending = (old?: MessagesData) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) =>
                p.map((m) => (m.id === tempId ? { ...m, pending: false } : m)),
              ),
            }
          : old;

      try {
        const res = await fetch(`/api/chat/${conversationId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });

        if (res.ok) {
          const saved: ChatMessageDto = await res.json();

          // Reconcile temp → real id/seq. If the socket echo beat us, the tempId
          // is already gone (no-op).
          queryClient.setQueryData<MessagesData>(key, (old) =>
            old
              ? {
                  ...old,
                  pages: old.pages.map((p) =>
                    p.map((m) =>
                      m.id === tempId
                        ? {
                            ...m,
                            id: saved.id,
                            seq: saved.seq,
                            sentAt: new Date(saved.sentAt).getTime(),
                            pending: false,
                          }
                        : m,
                    ),
                  ),
                }
              : old,
          );
        } else {
          queryClient.setQueryData<MessagesData>(key, clearPending);
        }
      } catch {
        queryClient.setQueryData<MessagesData>(key, clearPending);
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, myUserId, queryClient],
  );

  return {
    messages,
    sendMessage,
    isSending,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
  };
}
