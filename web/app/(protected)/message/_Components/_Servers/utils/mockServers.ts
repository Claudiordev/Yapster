import type { CommunityServer, ServerChannel, ServerTemplate } from "@/types/server";

import { defaultRoles, YOU_ID } from "./permissions";
import { ARCADE_ICON, NIGHTFALL_ICON } from "./serverIcons";

export const INITIAL_SERVERS: CommunityServer[] = [
  {
    id: "nf",
    name: "Nightfall",
    short: "NF",
    iconUrl: NIGHTFALL_ICON,
    ownerId: "ravi",
    roles: defaultRoles("nf"),
    members: [
      { id: "ravi", username: "Ravi", roleId: "nf-owner", status: "online" },
      { id: "maya", username: "Maya", roleId: "nf-mod", status: "online" },
      { id: "kai", username: "Kai", roleId: "nf-mod", status: "idle" },
      { id: "juno", username: "Juno", roleId: "nf-member", status: "online" },
      { id: "echo", username: "Echo", roleId: "nf-member", status: "busy" },
      { id: "sol", username: "Sol", roleId: "nf-member", status: "online" },
      { id: "nova", username: "Nova", roleId: "nf-member", status: "offline" },
      { id: "pix", username: "Pix", roleId: "nf-member", status: "offline" },
      { id: "sentinel", username: "Sentinel", roleId: "nf-member", status: "online", bot: true },
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
        { id: "w1", authorId: "ravi", time: "Mon 9:00 AM", body: "Welcome to Nightfall! Keep it friendly, no spoilers in #clips-and-wins, and have fun." },
        { id: "w2", system: true, time: "Today", body: "Juno joined the server" },
      ],
      announcements: [
        { id: "a1", authorId: "maya", time: "Yesterday 6:12 PM", body: "Counter-Strike 2 Clash is open. 500 spots, $1,500 for first place. Sign up from the Events tab.", reactions: [{ emoji: "🔥", count: 24, mine: true }, { emoji: "🎯", count: 11 }] },
      ],
      lobby: [
        { id: "l1", authorId: "juno", time: "Today 8:02 PM", body: "who's on tonight?" },
        { id: "l2", authorId: "sol", time: "Today 8:03 PM", body: "me, after dinner" },
      ],
      "squad-chat": [
        { id: "s1", authorId: "maya", time: "Today 9:30 PM", body: "Need one more for ranked. Hop in voice, we're in #Ranked grind." },
        { id: "s2", authorId: "juno", time: "Today 9:31 PM", body: "omw, 2 minutes" },
        { id: "s3", authorId: "kai", time: "Today 9:32 PM", body: "I'll share my screen so we can review the last round", reactions: [{ emoji: "👍", count: 3 }] },
        { id: "s4", authorId: "sentinel", time: "Today 9:35 PM", body: "Reminder: ranked queue closes at midnight." },
      ],
      clips: [
        { id: "c1", authorId: "echo", time: "Today 7:48 PM", body: "1v4 clutch on Mirage, full clip going up in a sec", reactions: [{ emoji: "🤯", count: 9 }, { emoji: "🔥", count: 6 }] },
      ],
      "mods-only": [
        { id: "m1", authorId: "maya", time: "Today 5:14 PM", body: "Two reports about spam in #lobby, I muted both for an hour." },
        { id: "m2", authorId: "kai", time: "Today 5:20 PM", body: "Thanks. If it happens again we ban." },
      ],
    },
  },
  {
    id: "ar",
    name: "Arcade Rats",
    short: "AR",
    iconUrl: ARCADE_ICON,
    ownerId: "pip",
    unread: 3,
    roles: defaultRoles("ar"),
    members: [
      { id: "pip", username: "Pip", roleId: "ar-owner", status: "online" },
      { id: "tess", username: "Tess", roleId: "ar-mod", status: "online" },
      { id: "dex", username: "Dex", roleId: "ar-member", status: "idle" },
      { id: "wren", username: "Wren", roleId: "ar-member", status: "offline" },
    ],
    channels: [
      { id: "general", name: "general", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member", topic: "Retro games and bad takes" },
      { id: "high-scores", name: "high-scores", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
      { id: "arcade-voice", name: "Cabinet", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
    ],
    messages: {
      general: [
        { id: "g1", authorId: "pip", time: "Today 4:10 PM", body: "New cabinet night on Friday. Bring your own quarters." },
        { id: "g2", authorId: "dex", time: "Today 4:12 PM", body: "pac-man tournament??" },
        { id: "g3", authorId: "tess", time: "Today 4:13 PM", body: "yes. pinning this.", reactions: [{ emoji: "📌", count: 2 }] },
      ],
    },
  },
];

const TEMPLATE_CHANNELS: Record<ServerTemplate, (id: string) => ServerChannel[]> = {
  gaming: (id) => [
    { id: `${id}-general`, name: "general", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-lfg`, name: "looking-for-group", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-clips`, name: "clips", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-voice`, name: "General", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
    { id: `${id}-squad`, name: "Squad 1", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
  ],
  friends: (id) => [
    { id: `${id}-general`, name: "general", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-voice`, name: "General", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
  ],
  community: (id) => [
    { id: `${id}-rules`, name: "rules", kind: "announce", category: "INFO", minView: "member", minSend: "mod" },
    { id: `${id}-general`, name: "general", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-intro`, name: "introductions", kind: "text", category: "TEXT CHANNELS", minView: "member", minSend: "member" },
    { id: `${id}-voice`, name: "General", kind: "voice", category: "VOICE CHANNELS", minView: "member", minSend: "member", voiceMembers: [] },
  ],
};

export const SERVER_TEMPLATES: { id: ServerTemplate; label: string; hint: string }[] = [
  { id: "gaming", label: "Gaming crew", hint: "Looking-for-group, clips, squad voice" },
  { id: "friends", label: "Friends", hint: "One text and one voice channel" },
  { id: "community", label: "Community", hint: "Rules, announcements, introductions" },
];

/** A brand new server owned by the viewer. */
export function makeServer(name: string, template: ServerTemplate, iconUrl?: string): CommunityServer {
  const id = `s${Date.now()}`;
  const short =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "NS";

  return {
    id,
    name,
    short,
    iconUrl,
    ownerId: YOU_ID,
    roles: defaultRoles(id),
    members: [],
    channels: TEMPLATE_CHANNELS[template](id),
    messages: {},
  };
}
