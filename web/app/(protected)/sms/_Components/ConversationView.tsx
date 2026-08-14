"use client";

import { useEffect, useMemo, useState } from "react";

import { AddMemberModal } from "./_Chat/AddMemberModal";
import { ChatThread, type MessageSender } from "./_Chat/ChatThread";
import { ManageGroupModal } from "./_Chat/ManageGroupModal";
import { useChat } from "./ChatProvider";
import { useMessages } from "./_Message/useMessages";
import { useTyping } from "./_Message/useTyping";

import { conversationName, isGroupCreator } from "@/lib/chat";

/** The thread for a single conversation, rendered at /sms/[conversationId]. */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const { conversations, markRead, account, addMember, removeMember, deleteGroup } =
    useChat();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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

  const isGroup = active?.type === "GROUP";
  const amCreator = active ? isGroupCreator(active, account.userId) : false;
  const memberIds = useMemo(
    () => [account.userId, ...(active?.members.map((m) => m.id) ?? [])].filter(
      (id): id is string => id != null,
    ),
    [account.userId, active],
  );

  return (
    <>
      <ChatThread
        hasMore={hasMore}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isSending={isSending}
        messages={messages}
        senders={senders}
        title={title}
        onAddMember={isGroup ? () => setAddMemberOpen(true) : undefined}
        onLoadMore={loadMore}
        onManageGroup={amCreator ? () => setManageOpen(true) : undefined}
        typingNames={typingNames}
        onSend={sendMessage}
        onType={notifyTyping}
      />

      {isGroup && (
        <AddMemberModal
          existingMemberIds={memberIds}
          isOpen={addMemberOpen}
          onAdd={(user) => addMember(conversationId, user)}
          onClose={() => setAddMemberOpen(false)}
        />
      )}

      {isGroup && active && amCreator && account.userId && (
        <ManageGroupModal
          conversation={active}
          isOpen={manageOpen}
          myUserId={account.userId}
          myUsername={account.username}
          onClose={() => setManageOpen(false)}
          onDeleteGroup={() => deleteGroup(conversationId)}
          onRemoveMember={(userId) => removeMember(conversationId, userId)}
        />
      )}
    </>
  );
}
