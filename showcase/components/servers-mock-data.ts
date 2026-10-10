// Mock data for the "servers" UI preview. Shapes intentionally mirror the backend plan:
// server -> roles (permission bitfield as a string list) -> channels (min tier to view / send) -> members.

export type Tier = "member" | "mod" | "owner";
export type Status = "online" | "idle" | "busy" | "offline";

export type Perm =
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

export const PERMISSIONS: { group: string; items: { key: Perm; label: string; hint: string }[] }[] = [
  {
    group: "General",
    items: [
      { key: "VIEW_CHANNEL", label: "View channels", hint: "See the channels this role has access to" },
      { key: "CREATE_INVITE", label: "Create invites", hint: "Invite new people with a link" },
    ],
  },
  {
    group: "Text & voice",
    items: [
      { key: "SEND_MESSAGES", label: "Send messages", hint: "Post in text channels" },
      { key: "CONNECT", label: "Connect", hint: "Join voice channels" },
      { key: "SPEAK", label: "Speak", hint: "Talk in voice channels" },
    ],
  },
  {
    group: "Moderation",
    items: [
      { key: "KICK_MEMBERS", label: "Kick members", hint: "Remove members, they can rejoin with an invite" },
      { key: "BAN_MEMBERS", label: "Ban members", hint: "Remove members and block them from rejoining" },
    ],
  },
  {
    group: "Management",
    items: [
      { key: "MANAGE_CHANNELS", label: "Manage channels", hint: "Create, edit and delete channels" },
      { key: "MANAGE_ROLES", label: "Manage roles", hint: "Edit roles below their own" },
      { key: "MANAGE_SERVER", label: "Manage server", hint: "Change name and icon, delete the server" },
      { key: "ADMINISTRATOR", label: "Administrator", hint: "Bypasses every check, including channel overrides" },
    ],
  },
];

export type Role = { id: string; name: string; color: string; tier: Tier; perms: Perm[]; badge?: string };

export type Member = { id: string; name: string; roleId: string; status: Status; tone: number; bot?: boolean };

export type Channel = {
  id: string;
  name: string;
  kind: "text" | "announce" | "voice";
  category: string;
  minView: Tier;
  minSend: Tier;
  topic?: string;
  voiceMembers?: string[];
};

export type Message = {
  id: string;
  authorId?: string;
  text: string;
  time: string;
  system?: boolean;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
};

export type ServerData = {
  id: string;
  name: string;
  short: string;
  gradient: string;
  ownerId: string;
  unread?: number;
  roles: Role[];
  members: Member[];
  channels: Channel[];
  messages: Record<string, Message[]>;
};

export const TONES = [
  "linear-gradient(145deg,#ff7a8a,#c8243b)",
  "linear-gradient(145deg,#ffc56b,#d6702f)",
  "linear-gradient(145deg,#7ee0a1,#2a9d63)",
  "linear-gradient(145deg,#7ab8ff,#3a64d8)",
  "linear-gradient(145deg,#c9a2ff,#7a45d6)",
  "linear-gradient(145deg,#8be3e0,#2a8f9e)",
];

export const TIER_RANK: Record<Tier, number> = { member: 0, mod: 1, owner: 2 };

export function defaultRoles(prefix: string): Role[] {
  return [
    {
      id: `${prefix}-owner`,
      name: "Owner",
      color: "#ffca56",
      tier: "owner",
      badge: "crown",
      perms: ["ADMINISTRATOR"],
    },
    {
      id: `${prefix}-mod`,
      name: "Moderator",
      color: "#b58cff",
      tier: "mod",
      perms: ["KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_CHANNELS", "CREATE_INVITE"],
    },
    {
      id: `${prefix}-member`,
      name: "Member",
      color: "#c9ccd1",
      tier: "member",
      perms: ["VIEW_CHANNEL", "SEND_MESSAGES", "CONNECT", "SPEAK", "CREATE_INVITE"],
    },
  ];
}

const nightfallRoles = defaultRoles("nf");

export const INITIAL_SERVERS: ServerData[] = [
  {
    id: "nf",
    name: "Nightfall",
    short: "NF",
    gradient: "linear-gradient(145deg,#ff6878,#8c1023)",
    ownerId: "ravi",
    roles: nightfallRoles,
    members: [
      { id: "ravi", name: "Ravi", roleId: "nf-owner", status: "online", tone: 1 },
      { id: "maya", name: "Maya", roleId: "nf-mod", status: "online", tone: 0 },
      { id: "kai", name: "Kai", roleId: "nf-mod", status: "idle", tone: 3 },
      { id: "juno", name: "Juno", roleId: "nf-member", status: "online", tone: 2 },
      { id: "echo", name: "Echo", roleId: "nf-member", status: "busy", tone: 4 },
      { id: "sol", name: "Sol", roleId: "nf-member", status: "online", tone: 5 },
      { id: "nova", name: "Nova", roleId: "nf-member", status: "offline", tone: 0 },
      { id: "pix", name: "Pix", roleId: "nf-member", status: "offline", tone: 3 },
      { id: "sentinel", name: "Sentinel", roleId: "nf-member", status: "online", tone: 4, bot: true },
    ],
    channels: [
      { id: "welcome", name: "welcome", kind: "text", category: "INFO", minView: "member", minSend: "mod", topic: "Read the rules, say hi in #lobby" },
      { id: "announcements", name: "announcements", kind: "announce", category: "INFO", minView: "member", minSend: "mod", topic: "Events, patch notes and tournaments" },
      { id: "lobby", name: "lobby", kind: "text", category: "PLAYGROUND", minView: "member", minSend: "member", topic: "Anything goes. Be kind." },
      { id: "squad-chat", name: "squad-chat", kind: "text", category: "PLAYGROUND", minView: "member", minSend: "member", topic: "Find a squad for tonight" },
      { id: "clips", name: "clips-and-wins", kind: "text", category: "PLAYGROUND", minView: "member", minSend: "member", topic: "Your best plays" },
      { id: "mods-only", name: "mods-only", kind: "text", category: "STAFF", minView: "mod", minSend: "mod", topic: "Reports and ban appeals" },
      { id: "warmup", name: "The warmup", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: ["echo"] },
      { id: "ranked", name: "Ranked grind", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: ["maya", "juno", "kai"] },
      { id: "staff-voice", name: "Staff room", kind: "voice", category: "STAFF", minView: "mod", minSend: "mod", voiceMembers: [] },
    ],
    messages: {
      welcome: [
        { id: "w1", authorId: "ravi", time: "Mon 9:00 AM", text: "Welcome to Nightfall! Keep it friendly, no spoilers in #clips-and-wins, and have fun." },
        { id: "w2", system: true, time: "Today", text: "Juno joined the server" },
      ],
      announcements: [
        { id: "a1", authorId: "maya", time: "Yesterday 6:12 PM", text: "Counter-Strike 2 Clash is open. 500 spots, $1,500 for first place. Sign up from the Events tab.", reactions: [{ emoji: "🔥", count: 24, mine: true }, { emoji: "🎯", count: 11 }] },
      ],
      lobby: [
        { id: "l1", authorId: "juno", time: "Today 8:02 PM", text: "who's on tonight?" },
        { id: "l2", authorId: "sol", time: "Today 8:03 PM", text: "me, after dinner" },
      ],
      "squad-chat": [
        { id: "s1", authorId: "maya", time: "Today 9:30 PM", text: "Need one more for ranked. Hop in voice, we're in #Ranked grind." },
        { id: "s2", authorId: "juno", time: "Today 9:31 PM", text: "omw, 2 minutes" },
        { id: "s3", authorId: "kai", time: "Today 9:32 PM", text: "I'll share my screen so we can review the last round", reactions: [{ emoji: "👍", count: 3 }] },
        { id: "s4", authorId: "sentinel", time: "Today 9:35 PM", text: "Reminder: ranked queue closes at midnight." },
      ],
      clips: [
        { id: "c1", authorId: "echo", time: "Today 7:48 PM", text: "1v4 clutch on Mirage, full clip going up in a sec", reactions: [{ emoji: "🤯", count: 9 }, { emoji: "🔥", count: 6 }] },
      ],
      "mods-only": [
        { id: "m1", authorId: "maya", time: "Today 5:14 PM", text: "Two reports about spam in #lobby, I muted both for an hour." },
        { id: "m2", authorId: "kai", time: "Today 5:20 PM", text: "Thanks. If it happens again we ban." },
      ],
    },
  },
  {
    id: "ar",
    name: "Arcade Rats",
    short: "AR",
    gradient: "linear-gradient(145deg,#ffbd57,#d66a35)",
    ownerId: "pip",
    unread: 3,
    roles: defaultRoles("ar"),
    members: [
      { id: "pip", name: "Pip", roleId: "ar-owner", status: "online", tone: 1 },
      { id: "tess", name: "Tess", roleId: "ar-mod", status: "online", tone: 2 },
      { id: "dex", name: "Dex", roleId: "ar-member", status: "idle", tone: 3 },
      { id: "wren", name: "Wren", roleId: "ar-member", status: "offline", tone: 4 },
    ],
    channels: [
      { id: "general", name: "general", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member", topic: "Retro games and bad takes" },
      { id: "high-scores", name: "high-scores", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
      { id: "arcade-voice", name: "Cabinet", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
    ],
    messages: {
      general: [
        { id: "g1", authorId: "pip", time: "Today 4:10 PM", text: "New cabinet night on Friday. Bring your own quarters." },
        { id: "g2", authorId: "dex", time: "Today 4:12 PM", text: "pac-man tournament??" },
        { id: "g3", authorId: "tess", time: "Today 4:13 PM", text: "yes. pinning this.", reactions: [{ emoji: "📌", count: 2 }] },
      ],
    },
  },
];
