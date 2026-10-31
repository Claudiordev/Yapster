"use client";

import { addToast } from "@heroui/toast";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { Icon } from "@/components/Icon/Icon";

interface MessageContextMenuProps {
  body: string;
  /** Offers "Add Reaction" when set (not for unsent messages or when emoji are disabled). */
  onAddReaction?: () => void;
  x: number;
  y: number;
  onClose: () => void;
}

const MENU_WIDTH = 180;
const MENU_HEIGHT = 48;
const MENU_ITEM_HEIGHT = 36;

/**
 * Right-click options menu for a message row. Same portal/positioning/outside-
 * close pattern as ParticipantVolumeMenu (call panel) — kept as its own
 * component here since actions (copy today, more later) are message-specific.
 */
export function MessageContextMenu({
  body,
  onAddReaction,
  x,
  y,
  onClose,
}: MessageContextMenuProps) {
  async function copyText() {
    try {
      await navigator.clipboard.writeText(body);
      addToast({ title: "Copied to clipboard", color: "default" });
    } catch {
      addToast({ title: "Couldn't copy text", color: "danger" });
    }

    onClose();
  }

  return (
    <FloatingMenu
      className="w-[180px] p-1"
      height={onAddReaction ? MENU_HEIGHT + MENU_ITEM_HEIGHT : MENU_HEIGHT}
      label="Message options"
      role="menu"
      width={MENU_WIDTH}
      x={x}
      y={y}
      onClose={onClose}
    >
      {onAddReaction && (
        <button
          className="flex w-full items-center gap-2 rounded-small px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-content2"
          role="menuitem"
          type="button"
          onClick={() => {
            onAddReaction();
            onClose();
          }}
        >
          <Icon className="text-default-400" name="smile" size={14} />
          Add Reaction
        </button>
      )}
      <button
        className="flex w-full items-center gap-2 rounded-small px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-content2"
        role="menuitem"
        type="button"
        onClick={copyText}
      >
        <Icon className="text-default-400" name="copy" size={14} />
        Copy Text
      </button>
    </FloatingMenu>
  );
}
