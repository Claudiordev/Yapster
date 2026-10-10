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
  roles: string[];
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
  /** User ids currently in this conversation's call (empty when there is none). */
  callParticipants?: string[];
}

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string | null;
  body: string;
  sentAt: string;
  seq: number;
  messageType: MessageKind;
  systemEvent: SystemEventCode | null;
  subjectId: string | null; // user a SYSTEM message is about
}

/** USER = written by a member; SYSTEM = announced by the chat itself (no sender). */
export type MessageKind = "USER" | "SYSTEM";
export type SystemEventCode =
  | "MEMBER_ADDED"
  | "MEMBER_REMOVED"
  | "MEMBER_LEFT"
  | "GROUP_RENAMED";

export type EventType =
  | "MESSAGE"
  | "TYPING"
  | "USER_STATUS_EVENT"
  | "CALL_STARTED"
  | "CALL_ENDED"
  | "CALL_REGION_CHANGED"
  | "CALL_PARTICIPANTS"
  | "ROLES_CHANGED"
  | "MEMBERS_CHANGED"
  | "PROFILE_CHANGED"
  | "GROUP_RENAMED";

/** Pushed when a new message lands — matches the backend MessageEvent. */
export interface MessageEvent {
  type: "MESSAGE";
  id: string; // stable server message id — used to dedupe echoes/redeliveries
  seq: number;
  roomId: string; // = conversationId
  senderId: string | null; // null for SYSTEM messages
  body: string;
  sentAt: string;
  messageType: MessageKind;
  systemEvent: SystemEventCode | null;
  subjectId: string | null;
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

/**
 * Pushed to everyone in a call when someone moved it to another server region.
 * Clients reconnect (fresh token → the new region's LiveKit URL).
 */
export interface CallRegionChangedEvent {
  type: "CALL_REGION_CHANGED";
  conversationId: string;
  region: string;
  regionName?: string;
}

/**
 * Who is in a conversation's call right now — matches the backend CallParticipantsEvent.
 * Always the FULL list: a client replaces what it shows, it never applies join/leave deltas.
 */
export interface CallParticipantsEvent {
  type: "CALL_PARTICIPANTS";
  conversationId: string;
  userIds: string[];
}

/**
 * Pushed to one user when an admin changed their roles — matches the backend
 * RolesChangedEvent. A pure signal: it carries no roles, the client re-reads
 * its own account.
 */
export interface RolesChangedEvent {
  type: "ROLES_CHANGED";
}

/**
 * A conversation's membership changed (group created, someone added or removed, group
 * deleted) — matches the backend MembersChangedEvent. A pure signal: the client reloads
 * its conversation list, which is where member names and pictures are resolved.
 */
export interface MembersChangedEvent {
  type: "MEMBERS_CHANGED";
  conversationId: string;
}

/**
 * Someone who shares a conversation with you changed their picture or username —
 * matches the backend ProfileChangedEvent. Also a signal: reload to pick up the change.
 */
export interface ProfileChangedEvent {
  type: "PROFILE_CHANGED";
  userId: string;
}

/**
 * A group was renamed — matches the backend GroupRenamedEvent. `name` is the new name,
 * or null when it was cleared (the group is shown as its members again).
 */
export interface GroupRenamedEvent {
  type: "GROUP_RENAMED";
  conversationId: string;
  name: string | null;
}

/** Any event the server can push over the socket. */
export type ServerEvent =
  | MessageEvent
  | TypeEvent
  | UserStatusServerEvent
  | CallStartedEvent
  | CallEndedEvent
  | CallRegionChangedEvent
  | CallParticipantsEvent
  | RolesChangedEvent
  | MembersChangedEvent
  | ProfileChangedEvent
  | GroupRenamedEvent;

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

export interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  sentAt: number;
  seq: number; // server order stamp; optimistic sends use PENDING_SEQ until saved
  fromMe: boolean;
  pending?: boolean;
  /** Set for chat-authored (SYSTEM) messages, which render without a sender. */
  system?: { event: SystemEventCode; subjectId: string };
}
