"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";

import { Icon } from "@/components/Icon/Icon";
import { StatusDot } from "@/components/StatusDot/StatusDot";
import type { UserIdentity } from "@/types/user";
import { MemberContextMenu } from "./MemberContextMenu";

export interface PanelMember extends UserIdentity {
  id: string;
}

interface MembersPanelProps {
  members: PanelMember[];
  myUserId?: string | null;
  /** The group's creator, marked with a crown. */
  creatorId?: string | null;
  /** Only the group creator can remove people. */
  canRemove: boolean;
  onSelect: (member: PanelMember) => void;
  onMessage: (member: PanelMember) => void;
  onCall: (member: PanelMember) => void;
  onRemove: (member: PanelMember) => void;
}

/** Side tab listing everyone in the conversation: picture, name and presence. */
export function MembersPanel({
  members,
  myUserId,
  creatorId,
  canRemove,
  onSelect,
  onMessage,
  onCall,
  onRemove,
}: MembersPanelProps) {
  const [menu, setMenu] = useState<{
    member: PanelMember;
    x: number;
    y: number;
  } | null>(null);

  return (
    <aside
      aria-label="Members"
      className="hidden w-60 flex-shrink-0 flex-col border-l border-divider md:flex"
    >
      <p className="flex-shrink-0 px-4 pb-2 pt-4 text-tiny font-semibold uppercase tracking-wide text-default-400">
        Members · {members.length}
      </p>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        {members.map((member) => (
          <li key={member.id}>
            <button
              className="flex w-full items-center gap-3 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-content2/70"
              type="button"
              onClick={() => onSelect(member)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ member, x: event.clientX, y: event.clientY });
              }}
            >
              <div className="relative flex-shrink-0">
                <Avatar
                  className="bg-default-200 text-brand ring-1 ring-default-300"
                  name={member.name.charAt(0).toUpperCase()}
                  size="sm"
                  src={member.avatarUrl ?? undefined}
                />
                <StatusDot
                  className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5"
                  name={member.name}
                  status={member.status}
                />
              </div>
              <span className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
                {member.name}
              </span>
              {member.id === creatorId && (
                <span
                  aria-label="Group creator"
                  className="flex-shrink-0 text-warning"
                  role="img"
                  title="Group creator"
                >
                  <Icon name="crown" size={14} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {menu && (
        <MemberContextMenu
          canRemove={canRemove}
          isOther={menu.member.id !== myUserId}
          x={menu.x}
          y={menu.y}
          onCall={() => onCall(menu.member)}
          onMessage={() => onMessage(menu.member)}
          onClose={() => setMenu(null)}
          onProfile={() => onSelect(menu.member)}
          onRemove={() => onRemove(menu.member)}
        />
      )}
    </aside>
  );
}
