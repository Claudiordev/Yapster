"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { addToast } from "@heroui/toast";

import {
  applyReaction,
  toThreadReactions,
} from "@/app/(protected)/message/_Components/_Message/utils/reactions";
import { randomId } from "@/lib/randomId";
import { readProblemDetail } from "@/lib/problemDetails";
import { useRealtime } from "@/lib/hooks/useRealtime";
import type { ChatMessageDto } from "@/types/chat";
import type { ThreadMessage } from "@/types/chat";

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
    senderId: m.senderId ?? "",
    sentAt: new Date(m.sentAt).getTime(),
    seq: m.seq,
    fromMe: m.senderId !== null && m.senderId === myUserId,
    system:
      m.messageType === "SYSTEM" && m.systemEvent && m.subjectId
        ? { event: m.systemEvent, subjectId: m.subjectId }
        : undefined,
    reactions: toThreadReactions(m.reactions, myUserId),
  };
}

/** Rewrites one cached message in place; every other message keeps its identity. */
function patchMessage(
  queryClient: QueryClient,
  key: ReturnType<typeof messagesKey>,
  messageId: string,
  update: (message: ThreadMessage) => ThreadMessage,
) {
  queryClient.setQueryData<MessagesData>(key, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => (m.id === messageId ? update(m) : m)),
          ),
        }
      : old,
  );
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

      // Throw rather than return []: a failed refetch then keeps the messages
      // already cached instead of replacing them with an empty thread.
      if (!res.ok) throw new Error(`Could not load messages (${res.status})`);

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
            senderId: event.senderId ?? "",
            sentAt,
            seq: event.seq,
            fromMe: event.senderId !== null && event.senderId === myUserId,
            system:
              event.messageType === "SYSTEM" && event.systemEvent && event.subjectId
                ? { event: event.systemEvent, subjectId: event.subjectId }
                : undefined,
            reactions: [],
          };

          // Newest page is index 0; position within a page doesn't matter (we sort).
          const pages = old.pages.map((p, i) => (i === 0 ? [msg, ...p] : p));

          return { ...old, pages };
        },
      );
    });
  }, [conversationId, myUserId, subscribe, queryClient]);

  // Reactions from everyone, including the echo of our own: applying one twice changes nothing.
  useEffect(() => {
    if (!conversationId) return;

    const key = messagesKey(conversationId, myUserId);
    const onReaction =
      (added: boolean) =>
      (event: { roomId: string; messageId: string; userId: string; emoji: string }) => {
        if (event.roomId !== conversationId) return;

        patchMessage(queryClient, key, event.messageId, (m) => ({
          ...m,
          reactions: applyReaction(m.reactions, event.emoji, event.userId, added, myUserId),
        }));
      };

    const offAdded = subscribe("REACTION_ADDED", onReaction(true));
    const offRemoved = subscribe("REACTION_REMOVED", onReaction(false));

    return () => {
      offAdded();
      offRemoved();
    };
  }, [conversationId, myUserId, subscribe, queryClient]);

  // Reactions with a request still running ("messageId:emoji"), so a double click costs one call.
  const reactionsInFlight = useRef(new Set<string>());

  /**
   * Reacts (or takes the reaction back) right away, then tells the server. If the server refuses
   * (rate limit, too many different emoji, ...) the change is undone and the reason is shown.
   * "add" never removes: picking an emoji you already used does nothing.
   */
  const react = useCallback(
    async (messageId: string, emoji: string, mode: "add" | "toggle") => {
      if (!conversationId || myUserId === null) return;

      const key = messagesKey(conversationId, myUserId);
      const message = queryClient
        .getQueryData<MessagesData>(key)
        ?.pages.flat()
        .find((m) => m.id === messageId);

      if (!message) return;

      const mine = message.reactions.some((r) => r.emoji === emoji && r.byMe);
      const add = mode === "toggle" ? !mine : true;
      const inFlightKey = `${messageId}:${emoji}`;

      if ((add && mine) || reactionsInFlight.current.has(inFlightKey)) return;

      reactionsInFlight.current.add(inFlightKey);

      const apply = (added: boolean) =>
        patchMessage(queryClient, key, messageId, (m) => ({
          ...m,
          reactions: applyReaction(m.reactions, emoji, myUserId, added, myUserId),
        }));

      apply(add);

      try {
        const res = await fetch(
          `/api/chat/${conversationId}/message/${messageId}/reaction/${emoji}`,
          { method: add ? "PUT" : "DELETE" },
        );

        if (!res.ok) {
          apply(!add);
          addToast({
            title: await readProblemDetail(res, "Couldn't update your reaction"),
            color: "danger",
          });
        }
      } catch {
        apply(!add);
        addToast({ title: "Couldn't update your reaction", color: "danger" });
      } finally {
        reactionsInFlight.current.delete(inFlightKey);
      }
    },
    [conversationId, myUserId, queryClient],
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => react(messageId, emoji, "add"),
    [react],
  );

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => react(messageId, emoji, "toggle"),
    [react],
  );

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
        reactions: [],
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
    addReaction,
    toggleReaction,
    isSending,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
  };
}
