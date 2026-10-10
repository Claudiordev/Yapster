import type { IconName } from "@/components/Icon/Icon";
import type { ServerChannel } from "@/types/server";

/** Categories in the order they first appear, each with its channels. */
export function groupByCategory(channels: ServerChannel[]): { category: string; channels: ServerChannel[] }[] {
  const groups: { category: string; channels: ServerChannel[] }[] = [];

  for (const channel of channels) {
    const group = groups.find((g) => g.category === channel.category);

    if (group) group.channels.push(channel);
    else groups.push({ category: channel.category, channels: [channel] });
  }

  return groups;
}

/**
 * The channel to show: the one in the URL if the viewer can see it, otherwise the first
 * text channel, otherwise whatever is visible (for example after previewing a lower role).
 */
export function pickActiveChannel(visible: ServerChannel[], channelId: string | null): ServerChannel | null {
  return (
    visible.find((c) => c.id === channelId) ?? visible.find((c) => c.kind !== "voice") ?? visible[0] ?? null
  );
}

export function channelHref(serverId: string, channelId: string): string {
  return `/message/server/${serverId}/${channelId}`;
}

/** Icon for a channel from the app's own icon set; private channels show the lock. */
export function channelIcon(channel: ServerChannel): IconName {
  if (channel.minView !== "member") return "lock";
  if (channel.kind === "voice") return "headphones";
  if (channel.kind === "announce") return "star";

  return "chat-bubble";
}

/** The pill shown next to a name, using the same badge style as ADMIN / MOD. */
export function roleBadgeFor(tier: "member" | "mod" | "owner"): { label: string; className: string } | null {
  if (tier === "owner") return { label: "OWNER", className: "call-role-badge--admin" };
  if (tier === "mod") return { label: "MOD", className: "call-role-badge--moderator" };

  return null;
}
