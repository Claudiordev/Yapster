"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Tab, Tabs } from "@heroui/tabs";
import { addToast } from "@heroui/toast";

import { Icon } from "@/components/Icon/Icon";
import { useAccount } from "@/lib/hooks/useAccount";
import type { UserProfile } from "@/types/user";
import type { ServerMember, ServerTier } from "@/types/server";

import { useServerAccess } from "../../_Actions/useServerAccess";
import { UserProfileModal } from "../_Chat/UserProfileModal";
import { MessageComposer } from "../_Message/MessageComposer";
import { useServers } from "../ServersProvider";
import { ServerMembers } from "./ServerMembers";
import { ServerMessages } from "./ServerMessages";
import { ServerVoiceRoom } from "./ServerVoiceRoom";
import { channelIcon, pickActiveChannel } from "./utils/channels";
import { YOU_ID } from "./utils/permissions";

const PREVIEW_ROLES: { tier: ServerTier; label: string }[] = [
  { tier: "owner", label: "Owner" },
  { tier: "mod", label: "Moderator" },
  { tier: "member", label: "Member" },
];

interface ServerViewProps {
  serverId: string;
  channelId: string | null;
}

/** The routed panel of an open server: channel header, messages or voice room, member list. */
export function ServerView({ serverId, channelId }: ServerViewProps) {
  const router = useRouter();
  const { avatarUrl, userId } = useAccount();
  const { viewAs, setViewAs, voice, sendMessage, joinVoice, leaveVoice, removeMember } = useServers();
  const { server, access, members } = useServerAccess(serverId);
  const [showMembers, setShowMembers] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  if (!server || !access) {
    return (
      <div className="flex flex-grow flex-col items-center justify-center gap-3 bg-background text-center dark:bg-surface-chat">
        <h2 className="text-lg font-bold text-foreground">Server not found</h2>
        <p className="text-sm text-default-500">It may have been deleted, or you left it.</p>
        <Button className="btn-coral font-bold" onPress={() => router.push("/message")}>
          Back to messages
        </Button>
      </div>
    );
  }

  const visible = server.channels.filter(access.canView);
  const channel = pickActiveChannel(visible, channelId);
  const connectedHere = voice?.serverId === server.id && voice.channelId === channel?.id;

  function openProfile(member: ServerMember) {
    setProfile({
      id: member.id === YOU_ID ? (userId ?? member.id) : member.id,
      name: member.username,
      avatarUrl: member.id === YOU_ID ? avatarUrl : null,
      roles: [],
      status: member.status,
    });
  }

  function moderate(member: ServerMember, ban: boolean) {
    removeMember(server!.id, member.id);
    addToast({ title: `${member.username} was ${ban ? "banned" : "kicked"}`, color: ban ? "danger" : "default" });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-grow flex-col bg-background text-foreground dark:bg-surface-chat">
      <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-divider px-4 shadow-sm">
        {channel && (
          <>
            <Avatar
              className="flex-shrink-0 bg-brand/10 text-brand ring-1 ring-brand/20"
              icon={<Icon name={channelIcon(channel)} size={16} />}
              size="sm"
            />
            <h2 className="truncate font-semibold text-foreground">{channel.name}</h2>
            {channel.topic && (
              <span className="hidden truncate border-l border-divider pl-3 text-sm text-default-500 md:block">
                {channel.topic}
              </span>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Mock only: view the server as a lower role would. Goes away once real roles exist. */}
          <Tabs
            aria-label="Preview as role"
            className="hidden sm:flex"
            color="danger"
            selectedKey={viewAs}
            size="sm"
            variant="bordered"
            onSelectionChange={(key) => setViewAs(key as ServerTier)}
          >
            {PREVIEW_ROLES.map((r) => (
              <Tab key={r.tier} title={r.label} />
            ))}
          </Tabs>

          <Button
            isIconOnly
            aria-label={showMembers ? "Hide members" : "Show members"}
            aria-pressed={showMembers}
            className={`chat-profile-action min-w-9 ${showMembers ? "chat-profile-action--send" : "chat-profile-settings"}`}
            size="sm"
            variant="light"
            onPress={() => setShowMembers((open) => !open)}
          >
            <Icon name="users" size={18} />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-grow">
        <div className="flex min-h-0 min-w-0 flex-grow flex-col">
          {!channel ? (
            <div className="flex flex-grow flex-col items-center justify-center gap-1 text-center">
              <h2 className="text-lg font-bold text-foreground">No channels you can see</h2>
              <p className="text-sm text-default-500">This role has no VIEW_CHANNEL permission.</p>
            </div>
          ) : channel.kind === "voice" ? (
            <ServerVoiceRoom
              channel={channel}
              connected={connectedHere}
              members={members}
              youAvatarUrl={avatarUrl}
              onJoin={() => {
                if (!access.has("CONNECT")) {
                  addToast({ title: "Missing permission: CONNECT", color: "danger" });

                  return;
                }
                joinVoice(server.id, channel.id);
              }}
              onLeave={leaveVoice}
            />
          ) : (
            <>
              <ServerMessages
                channel={channel}
                members={members}
                server={server}
                youAvatarUrl={avatarUrl}
                onOpenProfile={openProfile}
              />
              <MessageComposer
                isDisabled={!access.canSend(channel)}
                isSending={false}
                placeholder={
                  access.canSend(channel)
                    ? `Message #${channel.name}`
                    : "You do not have permission to send messages in this channel"
                }
                onSend={(body) => sendMessage(server.id, channel.id, body)}
              />
            </>
          )}
        </div>

        {showMembers && (
          <ServerMembers
            access={access}
            members={members}
            server={server}
            youAvatarUrl={avatarUrl}
            onBan={(m) => moderate(m, true)}
            onKick={(m) => moderate(m, false)}
            onSelect={openProfile}
          />
        )}
      </div>

      <UserProfileModal profile={profile} onClose={() => setProfile(null)} />
    </div>
  );
}
