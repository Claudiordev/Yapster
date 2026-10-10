/**
 * Community servers (Discord-style: roles, channels, members). Not to be confused with
 * the paid game servers in `_GameServers`. Mocked on the client until the backend exists;
 * the shapes mirror what the chat service is planned to return.
 */

/** Rank of a role. A higher tier outranks a lower one (kick/ban/manage only downwards). */
export type ServerTier = "member" | "mod" | "owner";

export type ServerPermission =
  | "VIEW_CHANNEL"
  | "SEND_MESSAGES"
  | "CONNECT"
  | "SPEAK"
  | "CREATE_INVITE"
  | "MANAGE_CHANNELS"
  | "KICK_MEMBERS"
  | "BAN_MEMBERS"
  | "MANAGE_ROLES"
  | "MANAGE_SERVER"
  | "ADMINISTRATOR";

export interface ServerRole {
  id: string;
  name: string;
  color: string;
  tier: ServerTier;
  permissions: ServerPermission[];
}

export interface ServerMember {
  id: string;
  username: string;
  roleId: string;
  status: "online" | "idle" | "busy" | "offline";
  bot?: boolean;
}

export type ServerChannelKind = "text" | "announce" | "voice";

export interface ServerChannel {
  id: string;
  name: string;
  kind: ServerChannelKind;
  category: string;
  /** Lowest tier that can see the channel. */
  minView: ServerTier;
  /** Lowest tier that can write in it. */
  minSend: ServerTier;
  topic?: string;
  /** Member ids currently in the voice channel (voice only). */
  voiceMembers?: string[];
}

export interface ServerMessage {
  id: string;
  authorId?: string;
  body: string;
  /** Pre-formatted for the mock. */
  time: string;
  system?: boolean;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
}

export interface CommunityServer {
  id: string;
  name: string;
  /** Initials shown on the rail key when there is no icon. */
  short: string;
  /** Server icon (image URL or data URL); falls back to the initials. */
  iconUrl?: string;
  ownerId: string;
  unread?: number;
  roles: ServerRole[];
  members: ServerMember[];
  channels: ServerChannel[];
  messages: Record<string, ServerMessage[]>;
}

export type ServerTemplate = "gaming" | "friends" | "community";
