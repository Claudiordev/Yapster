"use client";

import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";

import { Icon } from "@/components/Icon/Icon";
import { DROP_IN_MOTION_PROPS } from "@/lib/popupMotion";
import type { ThreadReaction } from "@/types/chat";

import { EmojiPicker } from "./EmojiPicker";
import {
  fromReactionKey,
  reactionNames,
  toReactionKey,
} from "./utils/reactions";

/** How long the pointer rests on a pill before the "reacted by" card drops in. */
const HOVER_DELAY_MS = 300;

interface MessageReactionsProps {
  reactions: ThreadReaction[];
  /** userId → display name, for the tooltip. */
  nameOf: (userId: string) => string;
  /** A pill was clicked: react, or take the reaction back. */
  onToggle: (emoji: string) => void;
  /** An emoji was picked from the "+" button. */
  onAdd: (emoji: string) => void;
  /** Whether the "+" button is offered (off while the message is unsent or emoji are disabled). */
  canAdd: boolean;
}

/**
 * The row of reaction pills under a message, Discord style: the emoji and how many used it,
 * highlighted when you are one of them. Nothing is drawn while there are no reactions; the
 * first one is added from the message's hover toolbar or right-click menu.
 */
export function MessageReactions({
  reactions,
  nameOf,
  onToggle,
  onAdd,
  canAdd,
}: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const emoji = fromReactionKey(reaction.emoji);

        return (
          <Tooltip
            key={reaction.emoji}
            closeDelay={0}
            content={
              <div className="flex max-w-96 items-center gap-3 px-2 py-1.5">
                <span className="flex-shrink-0 text-4xl leading-none">{emoji}</span>
                <span className="truncate text-sm text-default-600">
                  reacted by {reactionNames(reaction.userIds, nameOf)}
                </span>
              </div>
            }
            delay={HOVER_DELAY_MS}
            motionProps={DROP_IN_MOTION_PROPS}
            placement="top"
            size="lg"
          >
            <button
              aria-label={`${emoji} ${reaction.userIds.length}`}
              aria-pressed={reaction.byMe}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs tabular-nums transition-colors ${
                reaction.byMe
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-transparent bg-content2 text-default-500 hover:border-default-300"
              }`}
              type="button"
              onClick={() => onToggle(reaction.emoji)}
            >
              <span className="text-lg leading-none">{emoji}</span>
              <span>{reaction.userIds.length}</span>
            </button>
          </Tooltip>
        );
      })}

      {canAdd && (
        <EmojiPicker
          trigger={
            <Button
              aria-label="Add reaction"
              className="h-7 w-7 min-w-7 rounded-full bg-content2 text-default-400 hover:text-foreground"
              disableAnimation
              isIconOnly
              size="sm"
              variant="light"
            >
              <Icon name="smile" size={16} />
            </Button>
          }
          onSelect={(emoji) => onAdd(toReactionKey(emoji))}
        />
      )}
    </div>
  );
}
