"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalBody, ModalContent } from "@heroui/modal";

import { ProfileCard } from "./ProfileCard";
import { mockProfileFor } from "./utils/mockProfiles";
import { useChat } from "../ChatProvider";

import { Icon } from "@/components/Icon/Icon";
import { useAccount } from "@/lib/hooks/useAccount";
import type { UserProfile, UserProfileData } from "@/types/user";

interface UserProfileModalProps {
  profile: UserProfile | null;
  onClose: () => void;
}

/**
 * The profile popup for another person: banner, avatar with presence, role badges, name,
 * Message / Call, and the About tab. The passed-in profile (from the conversation's
 * cached members) renders instantly; on open we fetch the user's live profile so avatar,
 * roles and bio are never stale, and swap them in when it lands.
 */
export function UserProfileModal({ profile, onClose }: UserProfileModalProps) {
  const { userId } = useAccount();
  const { startConversation } = useChat();
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
  const isOther = profile !== null && profile.id !== userId;
  const mock = mockProfileFor(profile?.name);

  function reach(call: boolean) {
    if (!profile) return;
    void startConversation(
      { id: profile.id, username: profile.name, avatarUrl, roles },
      { call },
    );
    onClose();
  }

  return (
    <Modal
      backdrop="blur"
      classNames={{
        backdrop: "bg-black/70 backdrop-blur-2xl backdrop-saturate-50",
        base: "max-w-[460px] overflow-hidden rounded-[22px] border border-[#514556] bg-[#25262c] shadow-[0_24px_80px_rgba(0,0,0,0.5)]",
        closeButton: "right-4 top-4 z-10 rounded-[8px] border border-[#363842] bg-[#302b35] p-2",
      }}
      isOpen={profile !== null}
      scrollBehavior="inside"
      size="md"
      onClose={onClose}
    >
      <ModalContent>
        {profile && (
          <ModalBody className="gap-0 p-0">
            <ProfileCard
              embedded
              bannerColor={mock?.bannerColor ?? "graphite"}
              customStatus={mock?.customStatus}
              memberSince={mock?.memberSince}
              mutualFriends={mock?.mutualFriends}
              mutualServers={mock?.mutualServers}
              pronouns={mock?.pronouns}
              tabs
              actions={
                  <>
                    <Button
                      className="min-h-11 flex-grow rounded-[10px] border border-[#ff667e] bg-[#ff3b58] text-sm font-bold text-white shadow-[0_4px_0_#a11d33] data-[hover=true]:bg-[#ff4d67]"
                      isDisabled={!isOther}
                      startContent={<Icon name="chat-bubble" size={16} />}
                      onPress={() => reach(false)}
                    >
                      Message
                    </Button>
                    <Button
                      className="min-h-11 rounded-[10px] border border-[#54515c] bg-[#3b3c43] text-sm font-bold shadow-[0_3px_0_#222128]"
                      isDisabled={!isOther}
                      startContent={<Icon name="phone" size={16} />}
                      variant="flat"
                      onPress={() => reach(true)}
                    >
                      Call
                    </Button>
                  </>
              }
              avatarUrl={avatarUrl}
              bio={live?.bio ?? mock?.bio ?? null}
              bioPlaceholder={live || bioFailed ? "No bio yet." : "Loading…"}
              name={profile.name}
              roles={roles}
              status={profile.status}
              username={profile.name}
            />
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}
