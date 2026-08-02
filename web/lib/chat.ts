// Shared chat DTOs, mirroring the chat service.

/** A participant (other than the current user), resolved to display info by the BFF. */
export interface ConversationMember {
  id: string;
  username: string | null; // null if the user could not be resolved
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  type: string; // "DM" | "GROUP"
  name: string | null;
  members: ConversationMember[]; // other participants (self excluded) — the DM peer(s)
  lastMessage: string | null; // preview text; null when no messages yet
  lastMessageAt: string | null; // ISO instant of the last message
  lastMessageSeq: number | null; // seq of the last message
  lastReadSeq: number; // how far this user has read
  unreadCount: number; // messages in this conversation with seq > lastReadSeq
}

/** True when the conversation has messages the current user hasn't read. */
export function isUnread(c: Conversation): boolean {
  return c.unreadCount > 0;
}

/** Display name: group name, else the DM peer's username, else a fallback. */
export function conversationName(c: Conversation): string {
  return c.name ?? c.members[0]?.username ?? "Direct message";
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  sentAt: string;
  seq: number;
}

// --- Realtime events -------------------------------------------------------
// Mirror the chat service's socket event model: EventType (enum), ServerEvent
// (sealed interface), MessageEvent. Discriminated on `type`.

export type EventType = "MESSAGE";

/** Pushed when a new message lands — matches the backend MessageEvent. */
export interface MessageEvent {
  type: "MESSAGE";
  id: string; // stable server message id — used to dedupe echoes/redeliveries
  seq: number;
  roomId: string; // = conversationId
  senderId: string;
  body: string;
  sentAt: string;
}

/** Any event the server can push over the socket. */
export type ServerEvent = MessageEvent;
