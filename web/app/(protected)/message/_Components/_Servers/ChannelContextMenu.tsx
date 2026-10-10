"use client";

import { useState } from "react";
import { Button } from "@heroui/button";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { Icon } from "@/components/Icon/Icon";

interface ChannelContextMenuProps {
  name: string;
  isPrivate: boolean;
  hasUnread: boolean;
  /** MANAGE_CHANNELS: edit, change visibility and delete. */
  canManage: boolean;
  x: number;
  y: number;
  onMarkRead: () => void;
  onCopyLink: () => void;
  onEdit: () => void;
  onTogglePrivate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const ITEM_CLASS =
  "flex w-full items-center gap-2 rounded-small px-3 py-2 text-left text-small transition-colors hover:bg-default-100 disabled:pointer-events-none disabled:opacity-40";

/**
 * Right-click menu for one channel in the server's channel list: mark it read and copy its
 * link for everyone, edit it, flip it between public and private, or delete it with
 * MANAGE_CHANNELS. Deleting asks for confirmation, like deleting a group does.
 */
export function ChannelContextMenu({
  name,
  isPrivate,
  hasUnread,
  canManage,
  x,
  y,
  onMarkRead,
  onCopyLink,
  onEdit,
  onTogglePrivate,
  onDelete,
  onClose,
}: ChannelContextMenuProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <FloatingMenu className="p-3" height={150} label={`Delete ${name}`} width={MENU_WIDTH} x={x} y={y} onClose={onClose}>
        <p className="text-small font-semibold text-foreground">Delete this channel?</p>
        <p className="mt-1 text-tiny text-default-500">
          &quot;{name}&quot; and all its messages will be removed for everyone.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            color="danger"
            size="sm"
            variant="flat"
            onPress={() => {
              onDelete();
              onClose();
            }}
          >
            Delete
          </Button>
          <Button className="flex-1" size="sm" variant="light" onPress={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </FloatingMenu>
    );
  }

  const itemCount = 2 + (canManage ? 3 : 0);

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

      <button
        className={ITEM_CLASS}
        role="menuitem"
        type="button"
        onClick={() => {
          onCopyLink();
          onClose();
        }}
      >
        <Icon name="copy" size={14} />
        Copy channel link
      </button>

      {canManage && (
        <>
          <button
            className={ITEM_CLASS}
            role="menuitem"
            type="button"
            onClick={() => {
              onEdit();
              onClose();
            }}
          >
            <Icon name="edit" size={14} />
            Edit channel
          </button>

          <button
            className={ITEM_CLASS}
            role="menuitem"
            type="button"
            onClick={() => {
              onTogglePrivate();
              onClose();
            }}
          >
            <Icon name="lock" size={14} />
            {isPrivate ? "Make public" : "Make private"}
          </button>

          <button className={`${ITEM_CLASS} text-danger`} role="menuitem" type="button" onClick={() => setConfirming(true)}>
            <Icon name="trash" size={14} />
            Delete channel
          </button>
        </>
      )}
    </FloatingMenu>
  );
}
