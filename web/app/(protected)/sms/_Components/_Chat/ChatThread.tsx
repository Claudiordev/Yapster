"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";

import { MessageComposer } from "../_Message/MessageComposer";
import { TypingIndicator } from "../_Message/TypingIndicator";
import type { ThreadMessage } from "../_Message/useMessages";
import { formatClock } from "../chatTypes";

import { Icon } from "@/components/icon";

/** Display identity for a message's sender, resolved from conversation members. */
export interface MessageSender {
  name: string;
  avatarUrl: string | null;
  roles: string[];
}

interface ChatThreadProps {
  title: string;
  messages: ThreadMessage[];
  senders: Record<string, MessageSender>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  isSending: boolean;
  onSend: (body: string) => void;
  /** Display names of other members currently composing. */
  typingNames: string[];
  onType: () => void;
  /** Shows the "Add member" action in the header when set (group conversations only). */
  onAddMember?: () => void;
  /** Shows the "Manage group" action in the header when set (creator only). */
  onManageGroup?: () => void;
  /** Starts a voice call in this conversation. */
  onStartCall?: () => void;
  /** True while a call panel is already open for this conversation. */
  inCall?: boolean;
}

// Consecutive messages from the same sender within this window are grouped
// under one avatar/name header (Discord-style).
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Left-aligned placeholder rows while the first page of history loads. */
function ThreadSkeleton() {
  const widths = ["w-40", "w-56", "w-32", "w-48", "w-24"];

  return (
    <div aria-hidden className="flex flex-col gap-4">
      {widths.map((w, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="flex-shrink-0 w-8 h-8 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className={`h-3 ${w} rounded-md`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatThread({
  title,
  messages,
  senders,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  isSending,
  onSend,
  typingNames,
  onType,
  onAddMember,
  onManageGroup,
  onStartCall,
  inCall,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Scroll height captured right before a load-more, so we can keep the
  // viewport anchored to the same message after older ones are prepended.
  const anchorRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;

    if (!el) return;

    if (anchorRef.current !== null) {
      // Prepended older messages — preserve position instead of jumping down.
      el.scrollTop += el.scrollHeight - anchorRef.current;
      anchorRef.current = null;
    } else {
      // Initial load / new message — stick to the bottom.
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleScroll() {
    const el = scrollRef.current;

    if (!el || !hasMore || isLoadingMore) return;

    if (el.scrollTop <= 60) {
      anchorRef.current = el.scrollHeight;
      onLoadMore();
    }
  }

  // If the loaded messages don't fill the viewport, keep pulling older pages so
  // history is reachable — scrolling up requires the thread to overflow. Bounded
  // by `hasMore` (stops once the start of history is reached). No anchor here:
  // while filling we want to stay pinned to the latest message (bottom).
  useEffect(() => {
    const el = scrollRef.current;

    if (!el || isLoading || isLoadingMore || !hasMore) return;

    if (el.scrollHeight <= el.clientHeight + 8) onLoadMore();
  }, [messages, isLoading, isLoadingMore, hasMore, onLoadMore]);

  return (
    <div className="flex-grow flex flex-col min-h-0 bg-background dark:bg-surface-chat text-foreground">
      <div className="flex-shrink-0 flex items-center gap-2 px-4 h-14 border-b border-divider shadow-sm">
        <Avatar
          className="bg-brand/10 text-brand flex-shrink-0 ring-1 ring-brand/20"
          name={title.charAt(0).toUpperCase()}
          size="sm"
        />
        <h2 className="font-semibold truncate text-foreground">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          {onStartCall && (
            <Button
              isIconOnly
              aria-label={inCall ? "Call in progress" : "Start call"}
              className={inCall ? "text-brand" : "text-default-400 hover:text-foreground"}
              isDisabled={inCall}
              size="sm"
              variant="light"
              onPress={onStartCall}
            >
              <Icon name="phone" size={18} />
            </Button>
          )}
          {onAddMember && (
            <Button
              isIconOnly
              aria-label="Add member"
              className="text-default-400 hover:text-foreground"
              size="sm"
              variant="light"
              onPress={onAddMember}
            >
              <Icon name="plus" size={18} />
            </Button>
          )}
          {onManageGroup && (
            <Button
              isIconOnly
              aria-label="Manage group"
              className="text-default-400 hover:text-foreground"
              size="sm"
              variant="light"
              onPress={onManageGroup}
            >
              <Icon name="settings" size={18} />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-grow overflow-y-auto flex flex-col p-4 min-h-0"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <ThreadSkeleton />
        ) : messages.length === 0 ? (
          <p className="text-default-400 text-sm text-center py-8">
            No messages yet — say hi 👋
          </p>
        ) : (
          <>
            {isLoadingMore && (
              <p className="text-tiny text-default-400 text-center py-1 animate-pulse">
                Loading earlier messages…
              </p>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const startsGroup =
                !prev ||
                prev.senderId !== m.senderId ||
                m.sentAt - prev.sentAt > GROUP_WINDOW_MS;

              const sender = senders[m.senderId];
              const name = sender?.name ?? (m.fromMe ? "You" : "User");
              const avatarUrl = sender?.avatarUrl ?? undefined;

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${startsGroup ? "mt-4 first:mt-0" : "mt-0.5"}`}
                >
                  {startsGroup ? (
                    <Avatar
                      className="flex-shrink-0 mt-0.5 bg-default-200 text-brand"
                      name={name.charAt(0).toUpperCase()}
                      size="sm"
                      src={avatarUrl}
                    />
                  ) : (
                    <div aria-hidden className="w-8 flex-shrink-0" />
                  )}

                  <div className="min-w-0 flex-grow">
                    {startsGroup && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {name}
                        </span>
                        <span className="text-[10px] text-default-400">
                          {formatClock(m.sentAt)}
                        </span>
                      </div>
                    )}
                    <p
                      className={`text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere] ${
                        m.pending ? "opacity-60" : ""
                      }`}
                    >
                      {m.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <TypingIndicator names={typingNames} />

      <MessageComposer
        isDisabled={false}
        isSending={isSending}
        placeholder={`Message ${title}`}
        onSend={onSend}
        onType={onType}
      />
    </div>
  );
}
