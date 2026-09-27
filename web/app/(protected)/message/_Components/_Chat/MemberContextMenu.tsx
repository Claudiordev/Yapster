"use client";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { Icon } from "@/components/Icon/Icon";

interface MemberContextMenuProps {
  x: number;
  y: number;
  /** The menu is for someone else: they can be called (and removed, by the creator). */
  isOther: boolean;
  canRemove: boolean;
  onProfile: () => void;
  onMessage: () => void;
  onCall: () => void;
  onRemove: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 180;
const ITEM_HEIGHT = 34;

const ITEM =
  "flex w-full items-center gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-content2";

/** Right-click options for a person in the members tab. */
export function MemberContextMenu({
  x,
  y,
  isOther,
  canRemove,
  onProfile,
  onMessage,
  onCall,
  onRemove,
  onClose,
}: MemberContextMenuProps) {
  const items = 1 + (isOther ? 2 : 0) + (isOther && canRemove ? 1 : 0);

  return (
    <FloatingMenu
      className="w-[180px] p-1"
      height={items * ITEM_HEIGHT + 8}
      label="Member options"
      role="menu"
      width={MENU_WIDTH}
      x={x}
      y={y}
      onClose={onClose}
    >
      <button
        className={`${ITEM} text-foreground`}
        role="menuitem"
        type="button"
        onClick={() => {
          onProfile();
          onClose();
        }}
      >
        <Icon className="text-default-400" name="users" size={14} />
        Profile
      </button>
      {isOther && (
        <button
          className={`${ITEM} text-foreground`}
          role="menuitem"
          type="button"
          onClick={() => {
            onMessage();
            onClose();
          }}
        >
          <Icon className="text-default-400" name="chat-bubble" size={14} />
          Message
        </button>
      )}
      {isOther && (
        <button
          className={`${ITEM} text-foreground`}
          role="menuitem"
          type="button"
          onClick={() => {
            onCall();
            onClose();
          }}
        >
          <Icon className="text-default-400" name="phone" size={14} />
          Start call
        </button>
      )}
      {isOther && canRemove && (
        <button
          className={`${ITEM} text-danger`}
          role="menuitem"
          type="button"
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          <Icon name="trash" size={14} />
          Remove user
        </button>
      )}
    </FloatingMenu>
  );
}
