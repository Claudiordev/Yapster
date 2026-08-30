"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AddMemberModal } from "./_Chat/AddMemberModal";
import { ChatThread, type MessageSender } from "./_Chat/ChatThread";
import { ManageGroupModal } from "./_Chat/ManageGroupModal";
import { CallPanel } from "./_Call/CallPanel";
import { useChat } from "./ChatProvider";
import { useMessages } from "./_Message/useMessages";
import { useTyping } from "./_Message/useTyping";

import { conversationName, isGroupCreator } from "@/lib/chat";

/** The thread for a single conversation, rendered at /sms/[conversationId]. */
export function ConversationView({
  conversationId,
}: {
  conversationId: string;
}) {
  const {
    conversations,
    markRead,
    account,
    addMember,
    removeMember,
    deleteGroup,
    setActiveCall,
  } = useChat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  // Which conversation `callOpen` was last decided for. Needed because this
  // component is REUSED across /sms/[conversationId] changes (React keeps the
  // instance; only the prop changes), so a useState initializer would only
  // ever run for whichever conversation happened to be open first.
  const callDecidedFor = useRef<string | null>(null);

  // ?call=1 is set by the incoming-call prompt's Join button and means "open
  // straight into the call, not just the thread".
  useEffect(() => {
    const wantsCall = searchParams.get("call") === "1";

    if (callDecidedFor.current !== conversationId) {
      // Switched conversation: take the call state from the URL, which also
      // closes a call panel left open on the conversation we came from.
      callDecidedFor.current = conversationId;
      setCallOpen(wantsCall);
    } else if (wantsCall) {
      // Same conversation, Join pressed while already viewing it.
      setCallOpen(true);
    }

    // Strip the param so a refresh (or going back) doesn't silently re-join.
    // Note this re-runs the effect with the param gone -- which is why neither
    // branch above may set callOpen back to false.
    if (wantsCall) router.replace(`/sms/${conversationId}`, { scroll: false });
  }, [conversationId, searchParams, router]);

  // Tell the provider which call we're in, so it doesn't prompt us to join a
  // call we're already on when another member joins. Clears on close/unmount.
  useEffect(() => {
    setActiveCall(callOpen ? conversationId : null);

    return () => setActiveCall(null);
  }, [callOpen, conversationId, setActiveCall]);

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
      map[account.userId] = {
        name: account.username ?? "You",
        avatarUrl: account.avatarUrl,
      };
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
    () =>
      [account.userId, ...(active?.members.map((m) => m.id) ?? [])].filter(
        (id): id is string => id != null,
      ),
    [account.userId, active],
  );

  async function addGroupMember(user: Parameters<typeof addMember>[1]) {
    const added = await addMember(conversationId, user);

    if (added) {
      await sendMessage(`${user.username} was added to the chat`);
    }

    return added;
  }

  async function removeGroupMember(userId: string) {
    const member = active?.members.find((candidate) => candidate.id === userId);
    const removed = await removeMember(conversationId, userId);

    if (removed) {
      await sendMessage(
        `${member?.username ?? "A user"} was removed from the chat`,
      );
    }

    return removed;
  }

  return (
    <>
      {callOpen && (
        <CallPanel
          conversationId={conversationId}
          senders={senders}
          onClose={() => setCallOpen(false)}
        />
      )}

      <ChatThread
        hasMore={hasMore}
        inCall={callOpen}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isSending={isSending}
        messages={messages}
        senders={senders}
        title={title}
        onAddMember={isGroup ? () => setAddMemberOpen(true) : undefined}
        onLoadMore={loadMore}
        onManageGroup={amCreator ? () => setManageOpen(true) : undefined}
        onStartCall={() => setCallOpen(true)}
        typingNames={typingNames}
        onSend={sendMessage}
        onType={notifyTyping}
      />

      {isGroup && (
        <AddMemberModal
          existingMemberIds={memberIds}
          isOpen={addMemberOpen}
          onAdd={addGroupMember}
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
          onRemoveMember={removeGroupMember}
        />
      )}
    </>
  );
}
