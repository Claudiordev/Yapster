import type { ReactionDto, ThreadReaction } from "@/types/chat";

/**
 * How many names a reaction tooltip lists before it says "and N others". Few enough that the
 * whole line, including the "others" part, fits the one-line hover card.
 */
const TOOLTIP_NAMES = 3;

/**
 * Reactions are keyed by the emoji's Unicode code points in lowercase hex, joined by "-"
 * ("1f44d" for 👍, "2764-fe0f" for ❤️). This is the format the chat service stores and
 * validates; the picker hands us the character, so it is converted on the way out.
 */
export function toReactionKey(emoji: string): string {
  return Array.from(emoji, (char) =>
    (char.codePointAt(0) ?? 0).toString(16).padStart(4, "0"),
  ).join("-");
}

/** The character a reaction key stands for, for display. */
export function fromReactionKey(key: string): string {
  return String.fromCodePoint(...key.split("-").map((hex) => parseInt(hex, 16)));
}

export function toThreadReactions(
  reactions: ReactionDto[] | undefined,
  myUserId: string | null,
): ThreadReaction[] {
  return (reactions ?? []).map((reaction) => ({
    emoji: reaction.emoji,
    userIds: reaction.userIds,
    byMe: myUserId !== null && reaction.userIds.includes(myUserId),
  }));
}

/**
 * A reaction added or removed by `userId`. Idempotent by user: adding twice or removing what is
 * not there returns the same list, so the optimistic update, the server's echo of it and a
 * redelivered event can all be applied without double counting.
 */
export function applyReaction(
  reactions: ThreadReaction[],
  emoji: string,
  userId: string,
  added: boolean,
  myUserId: string | null,
): ThreadReaction[] {
  const current = reactions.find((reaction) => reaction.emoji === emoji);
  const isMe = (id: string) => id === myUserId;

  if (added) {
    if (!current) {
      return [...reactions, { emoji, userIds: [userId], byMe: isMe(userId) }];
    }

    if (current.userIds.includes(userId)) return reactions;

    return reactions.map((reaction) =>
      reaction === current
        ? { ...reaction, userIds: [...reaction.userIds, userId], byMe: reaction.byMe || isMe(userId) }
        : reaction,
    );
  }

  if (!current?.userIds.includes(userId)) return reactions;

  const userIds = current.userIds.filter((id) => id !== userId);

  if (userIds.length === 0) return reactions.filter((reaction) => reaction !== current);

  return reactions.map((reaction) =>
    reaction === current
      ? { ...reaction, userIds, byMe: reaction.byMe && !isMe(userId) }
      : reaction,
  );
}

/** "Alice, Bob and 2 others" for the tooltip on a reaction pill. */
export function reactionNames(
  userIds: string[],
  nameOf: (userId: string) => string,
): string {
  const names = userIds.slice(0, TOOLTIP_NAMES).map(nameOf);
  const others = userIds.length - names.length;

  if (others > 0) return `${names.join(", ")} and ${others} other${others === 1 ? "" : "s"}`;
  if (names.length <= 1) return names.join("");

  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
