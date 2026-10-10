"use client";

import { useState } from "react";
import { Avatar } from "@heroui/avatar";

import { FloatingMenu } from "@/components/FloatingMenu/FloatingMenu";
import { Icon } from "@/components/Icon/Icon";
import { StatusDot } from "@/components/StatusDot/StatusDot";
import type { CommunityServer, ServerMember } from "@/types/server";

import { TIER_RANK, YOU_ID, type ServerAccess } from "./utils/permissions";

interface ServerMembersProps {
  server: CommunityServer;
  members: ServerMember[];
  access: ServerAccess;
  youAvatarUrl: string | null;
  onSelect: (member: ServerMember) => void;
  onKick: (member: ServerMember) => void;
  onBan: (member: ServerMember) => void;
}

const MENU_WIDTH = 180;
const ITEM_HEIGHT = 34;
const ITEM = "flex w-full items-center gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-content2";

/** Side tab with everyone in the server grouped by role. Click for the profile, right-click to moderate. */
export function ServerMembers({ server, members, access, youAvatarUrl, onSelect, onKick, onBan }: ServerMembersProps) {
  const [menu, setMenu] = useState<{ member: ServerMember; x: number; y: number } | null>(null);

  const tierOf = (m: ServerMember) => server.roles.find((r) => r.id === m.roleId)?.tier ?? "member";

  const groups: { key: string; label: string; list: ServerMember[] }[] = [];

  [...server.roles]
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier])
    .filter((r) => r.tier !== "member")
    .forEach((role) => {
      const list = members.filter((m) => m.roleId === role.id && m.status !== "offline");

      if (list.length) groups.push({ key: role.id, label: `${role.name}${role.name.endsWith("s") ? "" : "s"}`, list });
    });

  const online = members.filter((m) => tierOf(m) === "member" && m.status !== "offline");
  const offline = members.filter((m) => m.status === "offline");

  if (online.length) groups.push({ key: "online", label: "Online", list: online });
  if (offline.length) groups.push({ key: "offline", label: "Offline", list: offline });

  const canModerate = (m: ServerMember) => m.id !== YOU_ID && TIER_RANK[tierOf(m)] < access.rank;

  return (
    <aside aria-label="Members" className="hidden w-60 flex-shrink-0 flex-col border-l border-divider md:flex">
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="flex-shrink-0 px-4 pb-2 pt-4 text-tiny font-semibold uppercase tracking-wide text-default-400">
              {g.label} · {g.list.length}
            </p>
            <ul className="flex flex-col gap-0.5 px-2">
              {g.list.map((member) => (
                <li key={member.id}>
                  <button
                    className={`flex w-full items-center gap-3 rounded-medium px-2 py-1.5 text-left transition-colors hover:bg-content2/70 ${
                      member.status === "offline" ? "opacity-60" : ""
                    }`}
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
                        name={member.username.charAt(0).toUpperCase()}
                        size="sm"
                        src={member.id === YOU_ID ? (youAvatarUrl ?? undefined) : undefined}
                      />
                      <StatusDot
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5"
                        name={member.username}
                        status={member.status}
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-small font-medium text-foreground">
                      {member.username}
                    </span>
                    {member.bot && <span className="call-role-badge call-role-badge--premium">BOT</span>}
                    {member.id === server.ownerId || (member.id === YOU_ID && access.rank === TIER_RANK.owner) ? (
                      <span aria-label="Owner" className="flex-shrink-0 text-warning" role="img" title="Owner">
                        <Icon name="crown" size={14} />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="flex-shrink-0 border-t border-divider px-4 py-2 text-tiny text-default-400">
        Right-click a member for moderation
      </p>

      {menu && (
        <FloatingMenu
          className="w-[180px] p-1"
          height={3 * ITEM_HEIGHT + 8}
          label="Member options"
          role="menu"
          width={MENU_WIDTH}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        >
          <button
            className={`${ITEM} text-foreground`}
            role="menuitem"
            type="button"
            onClick={() => {
              onSelect(menu.member);
              setMenu(null);
            }}
          >
            <Icon className="text-default-400" name="users" size={14} />
            Profile
          </button>
          <button
            className={`${ITEM} text-foreground disabled:opacity-40 disabled:hover:bg-transparent`}
            disabled={!(access.has("KICK_MEMBERS") && canModerate(menu.member))}
            role="menuitem"
            title={canModerate(menu.member) ? undefined : "Their role is not below yours"}
            type="button"
            onClick={() => {
              onKick(menu.member);
              setMenu(null);
            }}
          >
            <Icon className="text-default-400" name="logout" size={14} />
            Kick
          </button>
          <button
            className={`${ITEM} text-danger disabled:opacity-40 disabled:hover:bg-transparent`}
            disabled={!(access.has("BAN_MEMBERS") && canModerate(menu.member))}
            role="menuitem"
            title={canModerate(menu.member) ? undefined : "Their role is not below yours"}
            type="button"
            onClick={() => {
              onBan(menu.member);
              setMenu(null);
            }}
          >
            <Icon name="trash" size={14} />
            Ban
          </button>
        </FloatingMenu>
      )}
    </aside>
  );
}
