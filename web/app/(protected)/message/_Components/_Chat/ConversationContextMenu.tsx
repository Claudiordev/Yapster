"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { Icon } from "@/components/Icon/Icon";

interface ConversationContextMenuProps {
  /** Conversation name, used in the confirmation text and the label. */
  name: string;
  hasUnread: boolean;
  /** Members can leave a group they don't own. */
  canLeave: boolean;
  /** Any member can rename a group. */
  canRename: boolean;
  /** Only the creator can delete a group. */
  canDelete: boolean;
  x: number;
  y: number;
  onMarkRead: () => void;
  onRename: () => void;
  onLeave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-small px-3 py-2 text-left text-small transition-colors hover:bg-default-100 disabled:pointer-events-none disabled:opacity-40";

/**
 * Right-click menu for one conversation in the chat list: mark it read, rename it (groups), leave it (groups you don't own) or delete it
 * (groups you created). Leaving and deleting ask for confirmation.
 */
export function ConversationContextMenu({
  name,
  hasUnread,
  canLeave,
  canRename,
  canDelete,
  x,
  y,
  onMarkRead,
  onRename,
  onLeave,
  onDelete,
  onClose,
}: ConversationContextMenuProps) {
  const [confirming, setConfirming] = useState<"leave" | "delete" | null>(null);

  if (confirming) {
    const deleting = confirming === "delete";

    return (
      <FloatingMenu
        className="p-3"
        height={150}
        label={deleting ? `Delete ${name}` : `Leave ${name}`}
        width={MENU_WIDTH}
        x={x}
        y={y}
        onClose={onClose}
      >
        <p className="text-small font-semibold text-foreground">
          {deleting ? "Delete this group?" : "Leave this group?"}
        </p>
        <p className="mt-1 text-tiny text-default-500">
          {deleting
            ? `"${name}" and all its messages will be removed for everyone.`
            : `You will stop receiving messages from "${name}" until someone adds you again.`}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            color="danger"
            size="sm"
            variant="flat"
            onPress={() => {
              (deleting ? onDelete : onLeave)();
              onClose();
            }}
          >
            {deleting ? "Delete" : "Leave"}
          </Button>
          <Button
            className="flex-1"
            size="sm"
            variant="light"
            onPress={() => setConfirming(null)}
          >
            Cancel
          </Button>
        </div>
      </FloatingMenu>
    );
  }

  const itemCount =
    1 + (canRename ? 1 : 0) + (canLeave ? 1 : 0) + (canDelete ? 1 : 0);

  return (
    <FloatingMenu
      className="p-1"
      height={itemCount * 40 + 8}
      label={`Options for ${name}`}
      role="menu"
      width={MENU_WIDTH}
      x={x}
      y={y}
      onClose={onClose}
    >
      <button
        className={ITEM_CLASS}
        disabled={!hasUnread}
        role="menuitem"
        type="button"
        onClick={() => {
          onMarkRead();
          onClose();
        }}
      >
        <Icon name="check" size={14} />
        Mark as read
      </button>

      {canRename && (
        <button
          className={ITEM_CLASS}
          role="menuitem"
          type="button"
          onClick={() => {
            onRename();
            onClose();
          }}
        >
          <Icon name="edit" size={14} />
          Rename group
        </button>
      )}

      {canLeave && (
        <button
          className={`${ITEM_CLASS} text-danger`}
          role="menuitem"
          type="button"
          onClick={() => setConfirming("leave")}
        >
          <Icon name="logout" size={14} />
          Leave group
        </button>
      )}

      {canDelete && (
        <button
          className={`${ITEM_CLASS} text-danger`}
          role="menuitem"
          type="button"
          onClick={() => setConfirming("delete")}
        >
          <Icon name="trash" size={14} />
          Delete group
        </button>
      )}
    </FloatingMenu>
  );
}
