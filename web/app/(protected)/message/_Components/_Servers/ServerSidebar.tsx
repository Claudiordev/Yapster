"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/button";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";
import { addToast } from "@heroui/toast";
import { ChevronDown } from "lucide-react";

import { Icon } from "@/components/Icon/Icon";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";

import { useServerAccess } from "../../_Actions/useServerAccess";
import { useServers } from "../ServersProvider";
import { ChannelContextMenu } from "./ChannelContextMenu";
import { CreateChannelModal } from "./CreateChannelModal";
import { InviteModal } from "./InviteModal";
import { ServerSettingsModal } from "./ServerSettingsModal";
import { channelHref, channelIcon, groupByCategory, pickActiveChannel } from "./utils/channels";

/** Channel list of the open server, laid out like the chat list: same rows, labels and buttons. */
export function ServerSidebar({ serverId }: { serverId: string }) {
  const router = useRouter();
  const params = useParams<{ channelId?: string[] }>();
  const {
    servers,
    voice,
    unread,
    renameServer,
    setServerIcon,
    removeServer,
    addChannel,
    updateChannel,
    deleteChannel,
    markChannelRead,
    togglePermission,
    leaveVoice,
  } = useServers();
  const { server, access, members, viewAs } = useServerAccess(serverId);
  const [invite, setInvite] = useState(false);
  const [settings, setSettings] = useState(false);
  const [newChannel, setNewChannel] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ channelId: string; x: number; y: number } | null>(null);

  if (!server || !access) return <div className="flex-grow" />;

  const visible = server.channels.filter(access.canView);
  const hidden = server.channels.length - visible.length;
  const active = pickActiveChannel(visible, params.channelId?.[0] ?? null);
  const isOwner = viewAs === "owner";
  const categories = Array.from(new Set(server.channels.map((c) => c.category)));
  const editingChannel = server.channels.find((c) => c.id === editing);
  const menuChannel = server.channels.find((c) => c.id === menu?.channelId);

  const connectedServer = voice ? servers.find((s) => s.id === voice.serverId) : null;
  const connected = connectedServer?.channels.find((c) => c.id === voice?.channelId) ?? null;

  const disabled = [
    !access.has("CREATE_INVITE") && "invite",
    !(access.has("MANAGE_SERVER") || access.has("MANAGE_ROLES")) && "settings",
    !access.has("MANAGE_CHANNELS") && "channel",
    isOwner && "leave",
  ].filter(Boolean) as string[];

  function onMenu(key: string | number) {
    if (key === "invite") setInvite(true);
    if (key === "settings") setSettings(true);
    if (key === "channel") setNewChannel(true);
    if (key === "leave") {
      removeServer(serverId);
      router.push("/message");
    }
  }

  return (
    <>
      <div className="flex flex-shrink-0 flex-col gap-2 p-3">
        <Dropdown motionProps={POPUP_MOTION_PROPS} placement="bottom-start">
          <DropdownTrigger>
            <Button
              className="page-nav-active w-full justify-between font-medium text-foreground"
              endContent={<ChevronDown size={16} />}
              size="lg"
              startContent={
                <Avatar
                  className="h-8 w-8 flex-shrink-0 rounded-medium bg-default-200 text-brand ring-1 ring-default-300"
                  name={server.short}
                  radius="md"
                  src={server.iconUrl}
                />
              }
              variant="flat"
            >
              <span className="min-w-0 flex-grow truncate text-left">{server.name}</span>
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Server menu" disabledKeys={disabled} onAction={onMenu}>
            <DropdownItem key="invite" startContent={<Icon name="user" size={16} />}>
              Invite people
            </DropdownItem>
            <DropdownItem key="settings" startContent={<Icon name="settings" size={16} />}>
              Server settings
            </DropdownItem>
            <DropdownItem key="channel" startContent={<Icon name="plus" size={16} />}>
              Create channel
            </DropdownItem>
            <DropdownItem
              key="leave"
              className="text-danger"
              color="danger"
              description={isOwner ? "Owners must delete the server" : undefined}
              startContent={<Icon name="logout" size={16} />}
            >
              Leave server
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <div className="h-px bg-divider" />

      <aside className="flex min-h-0 flex-grow flex-col gap-3 p-3">
        <div className="min-h-0 flex-grow overflow-y-auto">
          {groupByCategory(visible).map((group) => (
            <div key={group.category} className="mb-3">
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-tiny font-semibold uppercase tracking-wide text-default-500">
                  {group.category}
                </span>
                {access.has("MANAGE_CHANNELS") && (
                  <Button
                    isIconOnly
                    aria-label="Create channel"
                    className="text-default-400 hover:text-foreground"
                    size="sm"
                    variant="light"
                    onPress={() => setNewChannel(true)}
                  >
                    <Icon name="plus" size={16} />
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {group.channels.map((c) => {
                  const isActive = active?.id === c.id;
                  const inVoice = voice?.serverId === server.id && voice.channelId === c.id;
                  const people = [...(c.voiceMembers ?? []), ...(inVoice ? ["you"] : [])];
                  const unreadCount = isActive ? 0 : (unread[c.id] ?? 0);

                  return (
                    <div key={c.id}>
                      <button
                        aria-pressed={isActive}
                        className={`flex w-full items-center gap-3 rounded-medium border-2 border-transparent px-3 py-2 text-left transition-[background-color,border-color,box-shadow] ${
                          isActive ? "chat-conversation-active text-white" : "text-foreground hover:bg-default-100"
                        }`}
                        type="button"
                        onClick={() => router.push(channelHref(server.id, c.id))}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setMenu({ channelId: c.id, x: event.clientX, y: event.clientY });
                        }}
                      >
                        <Icon
                          className={inVoice ? "text-success" : isActive ? "text-white/80" : "text-default-400"}
                          name={channelIcon(c)}
                          size={16}
                        />
                        <span className={`min-w-0 flex-grow truncate ${unreadCount ? "font-semibold" : "font-medium"}`}>
                          {c.name}
                        </span>
                        {c.kind === "voice" && people.length > 0 && (
                          <span className={`text-tiny ${isActive ? "text-white/70" : "text-default-400"}`}>
                            {people.length}
                          </span>
                        )}
                        {unreadCount > 0 && (
                          <span
                            aria-label={`${unreadCount} unread`}
                            className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-tiny font-semibold text-white"
                          >
                            {unreadCount}
                          </span>
                        )}
                      </button>

                      {c.kind === "voice" &&
                        people.map((pid) => {
                          const m = members.find((x) => x.id === pid);

                          if (!m) return null;

                          return (
                            <div key={pid} className="flex items-center gap-2 py-1 pl-9 pr-3 text-small text-default-500">
                              <Avatar
                                className="h-6 w-6 bg-default-200 text-tiny text-brand ring-1 ring-default-300"
                                name={m.username.charAt(0).toUpperCase()}
                              />
                              <span className="min-w-0 flex-grow truncate">{m.username}</span>
                              {pid === "maya" && <Icon className="text-brand" name="screen-share" size={13} />}
                              {pid === "echo" && <Icon className="text-danger" name="mic-off" size={13} />}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hidden > 0 && (
            <p className="flex items-center gap-1.5 px-2 pt-1 text-tiny text-default-400">
              <Icon name="lock" size={12} /> {hidden} channel{hidden > 1 ? "s" : ""} hidden by permissions
            </p>
          )}
        </div>
      </aside>

      {connected && connectedServer && (
        <div className="mx-3 mb-2 flex flex-shrink-0 items-center gap-3 rounded-medium bg-content2 px-3 py-2">
          <div className="min-w-0 flex-grow">
            <p className="flex items-center gap-1.5 text-small font-semibold text-success">
              <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(97,217,139,0.2)]" />
              Voice connected
            </p>
            <p className="truncate text-tiny text-default-500">
              {connected.name} · {connectedServer.name}
            </p>
          </div>
          <Button
            isIconOnly
            aria-label="Leave voice"
            className="call-control call-control--end"
            disableAnimation
            radius="none"
            variant="light"
            onPress={leaveVoice}
          >
            <Icon className="rotate-[135deg]" name="phone" size={16} />
          </Button>
        </div>
      )}

      <InviteModal isOpen={invite} server={server} onClose={() => setInvite(false)} />

      <CreateChannelModal
        categories={categories}
        isOpen={newChannel}
        onClose={() => setNewChannel(false)}
        onSubmit={(channel) => {
          addChannel(server.id, channel);
          addToast({ title: `Created ${channel.name}`, color: "success" });
          router.push(channelHref(server.id, channel.id));
        }}
      />

      {editingChannel && (
        <CreateChannelModal
          key={editingChannel.id}
          categories={categories}
          channel={editingChannel}
          isOpen
          onClose={() => setEditing(null)}
          onSubmit={({ id: _id, ...changes }) => {
            updateChannel(server.id, editingChannel.id, changes);
            addToast({ title: "Channel updated", color: "success" });
          }}
        />
      )}

      {menuChannel && menu && (
        <ChannelContextMenu
          canManage={access.has("MANAGE_CHANNELS")}
          hasUnread={(unread[menuChannel.id] ?? 0) > 0}
          isPrivate={menuChannel.minView !== "member"}
          name={menuChannel.name}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onCopyLink={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}${channelHref(server.id, menuChannel.id)}`);
            addToast({ title: "Channel link copied", color: "success" });
          }}
          onDelete={() => {
            deleteChannel(server.id, menuChannel.id);
            addToast({ title: `Deleted ${menuChannel.name}`, color: "default" });
            if (active?.id === menuChannel.id) router.push(`/message/server/${server.id}`);
          }}
          onEdit={() => setEditing(menuChannel.id)}
          onMarkRead={() => markChannelRead(menuChannel.id)}
          onTogglePrivate={() => {
            const makePrivate = menuChannel.minView === "member";

            updateChannel(server.id, menuChannel.id, {
              minView: makePrivate ? "mod" : "member",
              minSend: makePrivate ? "mod" : "member",
            });
            addToast({ title: `${menuChannel.name} is now ${makePrivate ? "private" : "public"}`, color: "success" });
          }}
        />
      )}

      {settings && (
        <ServerSettingsModal
          canManageRoles={access.has("MANAGE_ROLES")}
          canManageServer={access.has("MANAGE_SERVER")}
          isOpen={settings}
          isOwner={isOwner}
          memberCount={members.length}
          server={server}
          onClose={() => setSettings(false)}
          onDelete={() => {
            setSettings(false);
            removeServer(server.id);
            router.push("/message");
          }}
          onChangeIcon={(iconUrl) => setServerIcon(server.id, iconUrl)}
          onRename={(name) => renameServer(server.id, name)}
          onTogglePermission={(roleId, permission) => togglePermission(server.id, roleId, permission)}
        />
      )}
    </>
  );
}
