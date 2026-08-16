// Shared chat DTOs, mirroring the chat service.

/**
 * Presence shown as a coloured dot on the avatar.
 *
 * "online"/"offline" is CONNECTION state (does the user have an open socket);
 * "busy"/"idle" is user-set intent. A user who set "busy" but closed the app
 * is "offline" — connection always wins.
 */
export type UserStatus = "online" | "offline" | "busy" | "idle";

/** A participant (other than the current user), resolved to display info by the BFF. */
export interface ConversationMember {
  id: string;
  username: string | null; // null if the user could not be resolved
  avatarUrl: string | null;
  /** Absent until the backend supplies presence — treated as "offline". */
  status?: UserStatus;
}

export interface Conversation {
  id: string;
  type: string; // "DM" | "GROUP"
  name: string | null;
  /** Who created it. Only meaningful (and enforced) for GROUP conversations. */
  creatorId: string | null;
  members: ConversationMember[]; // other participants (self excluded) — the DM peer(s)
  lastMessage: string | null; // preview text; null when no messages yet
  lastMessageAt: string | null; // ISO instant of the last message
  lastMessageSeq: number | null; // seq of the last message
  lastReadSeq: number; // how far this user has read
  unreadCount: number; // messages in this conversation with seq > lastReadSeq
}

/** True when `userId` created this group (meaningless/false for DMs). */
export function isGroupCreator(c: Conversation, userId: string | null): boolean {
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

export type EventType =
  | "MESSAGE"
  | "TYPING"
  | "USER_STATUS_EVENT"
  | "CALL_STARTED"
  | "CALL_ENDED";

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

/**
 * Pushed while someone is composing — matches the backend server TypingEvent.
 * Transient: nothing is stored and there is no "stopped typing" event; the
 * indicator expires on a client-side timer instead.
 */
export interface TypeEvent {
  type: "TYPING";
  conversationId: string;
  senderId: string;
}

/**
 * Pushed when a member's presence changes — matches the backend server
 * UserStatusEvent. Sent to everyone sharing a conversation with them.
 */
export interface UserStatusServerEvent {
  type: "USER_STATUS_EVENT";
  userId: string;
  userStatusType: string; // UPPERCASE enum name: ONLINE | BUSY | IDLE | OFFLINE
}

/**
 * Pushed when someone starts (or joins an already-active) voice call —
 * matches the backend server CallStartedEvent. Sent to every other member
 * of the conversation, not just whoever's currently viewing it.
 */
export interface CallStartedEvent {
  type: "CALL_STARTED";
  conversationId: string;
  senderId: string;
}

/**
 * Pushed when someone leaves a voice call — matches the backend server
 * CallEndedEvent.
 */
export interface CallEndedEvent {
  type: "CALL_ENDED";
  conversationId: string;
  senderId: string;
}

/** Any event the server can push over the socket. */
export type ServerEvent =
  | MessageEvent
  | TypeEvent
  | UserStatusServerEvent
  | CallStartedEvent
  | CallEndedEvent;

/**
 * Anything the client may send UP the socket — mirrors the backend's
 * `ClientEvent` sealed interface. Deliberately tiny: message sending stays on
 * HTTP where it gets validation, persistence and a transaction.
 */
export interface TypingCommand {
  type: "TYPING";
  conversationId: string;
}

/**
 * The statuses a user may *choose*. OFFLINE is deliberately absent — it is
 * derived from the connection, never declared. Values are UPPERCASE to match
 * the backend's UserStatusType enum, which Jackson binds by name.
 */
export type SelectableStatus = "ONLINE" | "BUSY" | "IDLE";

export interface UserStatusCommand {
  type: "USER_STATUS_EVENT";
  userStatusType: SelectableStatus;
}

/** Sent when the local user starts (or joins) a voice call in a conversation. */
export interface CallStartedCommand {
  type: "CALL_STARTED";
  conversationId: string;
}

/** Sent when the local user leaves a voice call. */
export interface CallEndedCommand {
  type: "CALL_ENDED";
  conversationId: string;
}

export type ClientEvent =
  | TypingCommand
  | UserStatusCommand
  | CallStartedCommand
  | CallEndedCommand;
