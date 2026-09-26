import type { Conversation, EventType, MessageEvent, ServerEvent } from "@/types/chat";

// Shared chat DTOs, mirroring the chat service.

/** True when `userId` created this group (meaningless/false for DMs). */
export function isGroupCreator(
  c: Conversation,
  userId: string | null,
): boolean {
  return c.type === "GROUP" && userId != null && c.creatorId === userId;
}

/** True when the conversation has messages the current user hasn't read. */
export function isUnread(c: Conversation): boolean {
  return c.unreadCount > 0;
}

/** Display name: group name, else the DM peer's username, else a fallback. */
export function conversationName(c: Conversation): string {
  return c.name ?? c.members[0]?.username ?? "Direct message";
}

// --- Realtime events -------------------------------------------------------
// Mirror the chat service's socket event model: EventType (enum), ServerEvent
// (sealed interface), MessageEvent. Discriminated on `type`.

