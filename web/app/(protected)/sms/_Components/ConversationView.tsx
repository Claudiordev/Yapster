"use client";

import { useEffect, useMemo } from "react";

import { ChatThread, type MessageSender } from "./_Chat/ChatThread";
import { useChat } from "./ChatProvider";
import { useMessages } from "./_Message/useMessages";
import { useTyping } from "./_Message/useTyping";

import { conversationName } from "@/lib/chat";

/** The thread for a single conversation, rendered at /sms/[conversationId]. */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const { conversations, markRead, account } = useChat();

  const {
    messages,
    sendMessage,
    isSending,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useMessages(conversationId, account.userId);

  const { typingIds, notifyTyping } = useTyping(conversationId, account.userId);

  const active = conversations.find((c) => c.id === conversationId);
  const title = active ? conversationName(active) : "Direct message";

  // Clear unread on open and whenever a new message arrives while it's open.
  useEffect(() => {
    markRead(conversationId);
  }, [conversationId, active?.lastMessageSeq, markRead]);

  // senderId → name/avatar: peers from members, current user from the account.
  const senders = useMemo(() => {
    const map: Record<string, MessageSender> = {};

    if (account.userId) {
      map[account.userId] = { name: account.username ?? "You", avatarUrl: account.avatarUrl };
    }

    for (const member of active?.members ?? []) {
      map[member.id] = {
        name: member.username ?? "Unknown",
        avatarUrl: member.avatarUrl,
      };
    }

    return map;
  }, [account, active]);

  // Resolve the typing senderIds to display names via the same member map.
  const typingNames = useMemo(
    () => typingIds.map((id) => senders[id]?.name ?? "Someone"),
    [typingIds, senders],
  );

  return (
    <ChatThread
      hasMore={hasMore}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      isSending={isSending}
      messages={messages}
      senders={senders}
      title={title}
      onLoadMore={loadMore}
      typingNames={typingNames}
      onSend={sendMessage}
      onType={notifyTyping}
    />
  );
}
