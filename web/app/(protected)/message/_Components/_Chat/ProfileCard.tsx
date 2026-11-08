"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "@heroui/avatar";

import { bannerColorById } from "./utils/bannerColors";
import { linkifyBody } from "../_Message/utils/embeds";

import { Icon } from "@/components/Icon/Icon";
import { RoleBadge } from "@/components/RoleBadge/RoleBadge";
import { StatusDot } from "@/components/StatusDot/StatusDot";
import { badgesForRoles } from "@/lib/roleBadges";
import type { UserStatus } from "@/types/chat";
import type { BannerColorId } from "@/types/user";

interface ProfileCardProps {
  /** What to call them: display name when set, else username. */
  name: string;
  username: string;
  avatarUrl: string | null;
  roles: string[];
  /** Presence dot on the avatar; omitted when we have no live presence. */
  status?: UserStatus;
  pronouns?: string | null;
  customStatus?: string | null;
  bio: string | null;
  /** Shown instead of the bio while it is still loading or when there is none. */
  bioPlaceholder?: string;
  bannerColor?: BannerColorId;
  bannerImageUrl?: string | null;
  /** ISO date; the section is left out when null (unknown, or the person hides it). */
  memberSince?: string | null;
  /** Drop the outer border and shadow when the card sits inside a modal. */
  embedded?: boolean;
  /** Buttons under the status (Message / Call). */
  actions?: ReactNode;
  /** Show the About / Mutual friends / Servers tabs (the popup for other people). */
  tabs?: boolean;
  /** People/servers for the tabs; the count chip only appears once the list is known. */
  mutualFriends?: ProfileListItem[] | null;
  mutualServers?: ProfileListItem[] | null;
}

/** One row in the Mutual friends / Servers tabs. */
export interface ProfileListItem {
  id: string;
  name: string;
  /** Under the name: a friend's status, or a server's size. */
  subtitle?: string;
  avatarUrl?: string | null;
  /** Presence dot on the avatar (friends only). */
  status?: UserStatus;
}

type TabId = "about" | "friends" | "servers";

/**
 * The profile card everyone sees: banner, avatar with presence, role badges, name,
 * custom status, then About me and Member since. Used by the popup for other people
 * and by the live preview in your own profile editor, so the two cannot drift apart.
 */
export function ProfileCard({
  name,
  username,
  avatarUrl,
  roles,
  status,
  pronouns,
  customStatus,
  bio,
  bioPlaceholder = "No bio yet.",
  bannerColor = "brand",
  bannerImageUrl = null,
  memberSince = null,
  embedded = false,
  actions,
  tabs = false,
  mutualFriends = null,
  mutualServers = null,
}: ProfileCardProps) {
  const [tab, setTab] = useState<TabId>("about");
  const badges = badgesForRoles(roles);
  const banner = bannerColorById(bannerColor);
  const customStatusText = customStatus?.trim();
  const about = bio?.trim();
  const joined = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={`profile-card overflow-hidden ${
        embedded ? "rounded-t-[22px]" : "rounded-[18px] border border-[#514556] bg-[#25262c]"
      }`}
    >
      <div
        className={`h-24 w-full bg-cover bg-center ${bannerImageUrl ? "" : banner.className}`}
        style={bannerImageUrl ? { backgroundImage: `url(${bannerImageUrl})` } : undefined}
      />

      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end justify-between">
          <div className="relative">
            <Avatar
              className="h-20 w-20 bg-default-200 text-brand text-2xl ring-[6px] ring-[#25262c]"
              name={username.charAt(0).toUpperCase()}
              src={avatarUrl ?? undefined}
            />
            {status && (
              <StatusDot
                className="absolute bottom-1 right-1 h-4 w-4 !ring-[3px] !ring-[#25262c]"
                name={name}
                status={status}
              />
            )}
          </div>
          {badges.length > 0 && (
            <div className="mb-1 flex flex-wrap justify-end gap-1.5">
              {badges.map((badge) => (
                <RoleBadge key={badge.role} badge={badge} />
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 break-words text-2xl font-bold tracking-tight text-[#f2eaf7]">{name}</p>
        <p className="text-tiny text-[#b09abc]">
          @{username}
          {pronouns?.trim() && <span> · {pronouns.trim()}</span>}
        </p>

        {customStatusText && (
          <p className="mt-4 break-words rounded-medium border border-[#52404f] bg-[#312932] px-3 py-2.5 text-small text-[#d0c1da]">
            {customStatusText}
          </p>
        )}

        {actions && <div className="mt-4 flex gap-2.5">{actions}</div>}

        {tabs && (
          <div className="mt-5 flex gap-5 border-b border-[#554655]" role="tablist">
            {(
              [
                { id: "about", label: "About", count: null },
                { id: "friends", label: "Mutual friends", count: mutualFriends?.length ?? null },
                { id: "servers", label: "Servers", count: mutualServers?.length ?? null },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-selected={tab === item.id}
                className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2 text-small transition-colors ${
                  tab === item.id
                    ? "border-brand text-[#ffb1ca]"
                    : "border-transparent text-[#ab93ba] hover:text-[#ffb1ca]"
                }`}
                role="tab"
                type="button"
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {item.count !== null && (
                  <span className="rounded-small bg-[#3b2f44] px-1.5 text-tiny tabular-nums text-[#c9b8d1]">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {tab === "about" ? (
          <>
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b5a1bf]">
                About me
              </p>
              <p
                className={`mt-2.5 whitespace-pre-wrap text-[15px] leading-6 [overflow-wrap:anywhere] ${
                  about ? "text-[#d0c1da]" : "text-[#9d84aa]"
                }`}
              >
                {about
                  ? linkifyBody(about).map((part, index) =>
                      part.href ? (
                        <a
                          key={index}
                          className="underline underline-offset-2 hover:text-[#ffb1ca]"
                          href={part.href}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {part.text}
                        </a>
                      ) : (
                        part.text
                      ),
                    )
                  : bioPlaceholder}
              </p>
            </div>

            {joined && (
              <div className="mt-5 border-t border-[#2e2f34] pt-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b5a1bf]">
                  Member since
                </p>
                <p className="mt-2.5 text-[15px] leading-6 text-[#d0c1da]">{joined}</p>
              </div>
            )}
          </>
        ) : (
          <ul className="mt-2 flex flex-col">
            {(tab === "friends" ? mutualFriends : mutualServers)?.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-b border-[#2c2d33] py-4 last:border-b-0"
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="bg-default-200 text-brand ring-1 ring-default-300"
                    name={item.name.charAt(0).toUpperCase()}
                    size="md"
                    src={item.avatarUrl ?? undefined}
                  />
                  {item.status && (
                    <StatusDot
                      className="absolute bottom-0 right-0"
                      name={item.name}
                      status={item.status}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-grow">
                  <p className="truncate text-small font-bold text-[#f2eaf7]">{item.name}</p>
                  {item.subtitle && (
                    <p className="truncate text-tiny text-[#9d84aa]">{item.subtitle}</p>
                  )}
                </div>
                {tab === "friends" && (
                  <Icon className="flex-shrink-0 text-[#bd849e]" name="chat-bubble" size={14} />
                )}
              </li>
            )) ?? (
              <li className="mt-4 text-center text-small text-[#9d84aa]">
                {tab === "friends"
                  ? "No mutual friends to show yet."
                  : "No shared servers to show yet."}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
