import type {
  CommunityServer,
  ServerChannel,
  ServerMember,
  ServerPermission,
  ServerRole,
  ServerTier,
} from "@/types/server";

export const TIER_RANK: Record<ServerTier, number> = {
  member: 0,
  mod: 1,
  owner: 2,
};

export const PERMISSION_GROUPS: {
  group: string;
  items: { key: ServerPermission; label: string; hint: string }[];
}[] = [
  {
    group: "General",
    items: [
      { key: "VIEW_CHANNEL", label: "View channels", hint: "See the channels this role has access to" },
      { key: "CREATE_INVITE", label: "Create invites", hint: "Invite new people with a link" },
    ],
  },
  {
    group: "Text and voice",
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

export function defaultRoles(prefix: string): ServerRole[] {
  return [
    { id: `${prefix}-owner`, name: "Owner", color: "#ffca56", tier: "owner", permissions: ["ADMINISTRATOR"] },
    {
      id: `${prefix}-mod`,
      name: "Moderator",
      color: "#b58cff",
      tier: "mod",
      permissions: ["KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_CHANNELS", "CREATE_INVITE"],
    },
    {
      id: `${prefix}-member`,
      name: "Member",
      color: "#c9ccd1",
      tier: "member",
      permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "CONNECT", "SPEAK", "CREATE_INVITE"],
    },
  ];
}

export interface ServerAccess {
  role: ServerRole;
  rank: number;
  has: (permission: ServerPermission) => boolean;
  canView: (channel: ServerChannel) => boolean;
  canSend: (channel: ServerChannel) => boolean;
}

/**
 * Client-side mirror of what the backend will compute: the member role's permissions
 * plus the viewer's own role, owner and ADMINISTRATOR bypass everything, then each
 * channel's minimum tier is applied on top.
 */
export function resolveAccess(server: CommunityServer, tier: ServerTier): ServerAccess {
  const role = server.roles.find((r) => r.tier === tier) ?? server.roles[0];
  const granted = new Set<ServerPermission>();

  server.roles.find((r) => r.tier === "member")?.permissions.forEach((p) => granted.add(p));
  role.permissions.forEach((p) => granted.add(p));

  const rank = TIER_RANK[tier];
  const has = (p: ServerPermission) => tier === "owner" || granted.has("ADMINISTRATOR") || granted.has(p);
  const canView = (c: ServerChannel) => has("ADMINISTRATOR") || (has("VIEW_CHANNEL") && rank >= TIER_RANK[c.minView]);
  const canSend = (c: ServerChannel) =>
    canView(c) && (has("ADMINISTRATOR") || (has("SEND_MESSAGES") && rank >= TIER_RANK[c.minSend]));

  return { role, rank, has, canView, canSend };
}

export const YOU_ID = "you";

/** The member list with the viewer slotted in at the role being previewed. */
export function membersWithYou(
  server: CommunityServer,
  tier: ServerTier,
  you: { username: string },
): ServerMember[] {
  const role = server.roles.find((r) => r.tier === tier) ?? server.roles[0];
  const self: ServerMember = {
    id: YOU_ID,
    username: you.username,
    roleId: role.id,
    status: "online",
  };
  // Only one owner: when previewing as owner the viewer replaces the seeded one.
  const rest = tier === "owner" ? server.members.filter((m) => m.id !== server.ownerId) : server.members;

  return [self, ...rest];
}
