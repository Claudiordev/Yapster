"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addToast } from "@heroui/toast";

import { AddMemberModal } from "./_Chat/AddMemberModal";
import { RenameGroupModal } from "./_Chat/RenameGroupModal";
import { CallPresenceStrip } from "./_Chat/CallPresenceStrip";
import { ChatThread } from "./_Chat/ChatThread";
import type { UserStatus } from "@/types/chat";
import type { UserIdentity } from "@/types/user";
import { useCallSession } from "./CallProvider";
import { CallPanel } from "./_Call/CallPanel";
import { useChat } from "./ChatProvider";
import { useMessages } from "../_Actions/useMessages";
import { useTyping } from "../_Actions/useTyping";

import { conversationName, isGroupCreator } from "@/lib/chat";

/** The thread for a single conversation, rendered at /message/[conversationId]. */
const NO_ROLES: Record<string, string[]> = {};

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
    startConversation,
    deleteGroup,
    refreshCallParticipants,
    myStatus,
    isConnected,
    renameGroup,
  } = useChat();
  const { callConversationId, startCall, participantRoles } = useCallSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  // The call belongs to the provider, not to this view: navigating between
  // chats no longer ends it. This chat shows the panel only while it's THE call.
  const callHere = callConversationId === conversationId;

  // Conversations over the chat service's member cap get no live push, so read the
  // current call participants whenever this conversation is opened.
  useEffect(() => {
    void refreshCallParticipants(conversationId);
  }, [conversationId, refreshCallParticipants]);

  // Fresh roles of the people in the call come from the provider, so they survive
  // switching chats (see CallProvider.participantRoles).
  const liveRoles = callHere ? participantRoles : NO_ROLES;

  // ?call=1 is set by the incoming-call prompt's Join button and means "join
  // this chat's call now" (switching over if we're in another one).
  useEffect(() => {
    if (searchParams.get("call") !== "1") return;

    startCall(conversationId);
    // Strip the param so a refresh (or going back) doesn't silently re-join.
    router.replace(`/message/${conversationId}`, { scroll: false });
  }, [conversationId, searchParams, router, startCall]);

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

  // Was this chat in our list, then gone? We were removed from it (or it was deleted):
  // leave instead of sitting in a thread that can no longer be written to.
  const wasListed = useRef(false);

  useEffect(() => {
    wasListed.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (active) {
      wasListed.current = true;

      return;
    }

    if (wasListed.current) {
      wasListed.current = false;
      addToast({
        title: "You no longer have access to this conversation",
        color: "default",
      });
      router.replace("/message");
    }
  }, [active, router]);
  const title = active ? conversationName(active) : "Direct message";

  // Clear unread on open and whenever a new message arrives while it's open.
  useEffect(() => {
    markRead(conversationId);
  }, [conversationId, active?.lastMessageSeq, markRead]);

  const seenIdentities = useRef<Record<string, UserIdentity>>({});

  // senderId → name/avatar: peers from members, current user from the account.
  const senders = useMemo(() => {
    // Seeded with everyone seen so far, so a removed member's name still resolves.
    const map: Record<string, UserIdentity> = { ...seenIdentities.current };

    if (account.userId) {
      map[account.userId] = {
        name: account.username ?? "You",
        avatarUrl: account.avatarUrl,
        roles: account.roles,
        status: isConnected ? (myStatus.toLowerCase() as UserStatus) : "offline",
      };
    }

    for (const member of active?.members ?? []) {
      map[member.id] = {
        name: member.username ?? "Unknown",
        avatarUrl: member.avatarUrl,
        // Fresh roles for people in the call win over the loaded member list.
        roles: liveRoles[member.id] ?? member.roles,
        status: member.status,
      };
    }

    seenIdentities.current = map;

    return map;
  }, [account, active, liveRoles, myStatus, isConnected]);

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

  // Everyone in the conversation (you first), for the members side tab.
  const panelMembers = memberIds.flatMap((id) =>
    senders[id] ? [{ id, ...senders[id] }] : [],
  );

  async function addGroupMember(user: Parameters<typeof addMember>[1]) {
    // The chat service announces the addition itself (SYSTEM message).
    return addMember(conversationId, user);
  }

  async function removeGroupMember(userId: string) {
    // The chat service announces the removal itself (SYSTEM message).
    return removeMember(conversationId, userId);
  }

  return (
    <>
      {callHere && <CallPanel isGroupCreator={amCreator} senders={senders} />}

      <ChatThread
        headerExtra={
          callHere ? null : (
            <CallPresenceStrip
              participantIds={active?.callParticipants ?? []}
              people={senders}
              onJoin={() => startCall(conversationId)}
            />
          )
        }
        hasMore={hasMore}
        inCall={callHere}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        isSending={isSending}
        messages={messages}
        senders={senders}
        title={title}
        memberActions={{
          myUserId: account.userId ?? null,
          creatorId: active?.creatorId ?? null,
          canRemove: isGroup && amCreator,
          onMessage: (member) =>
            void startConversation({
              id: member.id,
              username: member.name,
              avatarUrl: member.avatarUrl,
              roles: member.roles,
            }),
          onCall: (member) =>
            void startConversation(
              {
                id: member.id,
                username: member.name,
                avatarUrl: member.avatarUrl,
                roles: member.roles,
              },
              { call: true },
            ),
          onRemove: async (member) => {
            const result = await removeGroupMember(member.id);

            if (!result.ok) addToast({ title: result.detail, color: "danger" });
          },
        }}
        members={isGroup ? panelMembers : undefined}
        onAddMember={isGroup ? () => setAddMemberOpen(true) : undefined}
        onRename={isGroup ? () => setRenameOpen(true) : undefined}
        onLoadMore={loadMore}
        onStartCall={() => startCall(conversationId)}
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

      {isGroup && (
        <RenameGroupModal
          currentName={active?.name ?? null}
          isOpen={renameOpen}
          onClose={() => setRenameOpen(false)}
          onSave={(name) => renameGroup(conversationId, name)}
        />
      )}
    </>
  );
}
