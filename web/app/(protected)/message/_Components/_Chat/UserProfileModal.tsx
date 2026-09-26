"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@heroui/avatar";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { StatusDot } from "@/components/StatusDot/StatusDot";
import { RoleBadge } from "@/components/RoleBadge/RoleBadge";
import { badgesForRoles } from "@/lib/roleBadges";

import type { UserProfile, UserProfileData } from "@/types/user";
import type { UserStatus } from "@/types/chat";

interface UserProfileModalProps {
  profile: UserProfile | null;
  onClose: () => void;
}

/**
 * Discord-style profile popup — avatar, name, status, role badges, bio. The
 * passed-in profile (from the conversation's cached members) renders
 * instantly; on open we fetch the user's live profile so avatar, roles and
 * bio are never stale, and swap them in when it lands.
 */
export function UserProfileModal({ profile, onClose }: UserProfileModalProps) {
  const [live, setLive] = useState<UserProfileData | null>(null);
  const [bioFailed, setBioFailed] = useState(false);
  const profileId = profile?.id ?? null;

  useEffect(() => {
    setLive(null);
    setBioFailed(false);
    if (!profileId) return;

    const controller = new AbortController();

    fetch(`/api/users/${encodeURIComponent(profileId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<UserProfileData>) : Promise.reject()))
      .then(setLive)
      .catch(() => {
        if (!controller.signal.aborted) setBioFailed(true);
      });

    return () => controller.abort();
  }, [profileId]);

  const roles = live?.roles ?? profile?.roles ?? [];
  const avatarUrl = live ? live.avatarUrl : (profile?.avatarUrl ?? null);
  const bio = live?.bio?.trim() || null;
  const badges = badgesForRoles(roles);

  return (
    <Modal backdrop="blur" isOpen={profile !== null} size="sm" onClose={onClose}>
      <ModalContent>
        {profile && (
          <ModalBody className="gap-0 p-0">
            <div className="h-20 w-full rounded-t-large bg-gradient-to-br from-brand to-brand-deep" />

            <div className="flex flex-col items-center px-5 pb-5 -mt-10">
              <div className="relative">
                <Avatar
                  className="h-20 w-20 bg-default-200 text-brand text-2xl ring-4 ring-content1"
                  name={profile.name.charAt(0).toUpperCase()}
                  src={avatarUrl ?? undefined}
                />
                {profile.status && (
                  <StatusDot
                    className="absolute bottom-1 right-1 h-4 w-4"
                    name={profile.name}
                    status={profile.status}
                  />
                )}
              </div>

              <p className="mt-3 text-lg font-semibold text-foreground">{profile.name}</p>

              {badges.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {badges.map((badge) => (
                    <RoleBadge key={badge.role} badge={badge} />
                  ))}
                </div>
              )}

              <div className="mt-4 w-full rounded-medium bg-content2 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-default-400">
                  About Me
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-default-500">
                  {bio ?? (live || bioFailed ? "No bio yet." : "Loading…")}
                </p>
              </div>
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}
