"use client";

import { useCallback, useState } from "react";

import type {
  CommunityServer,
  ServerChannel,
  ServerMessage,
  ServerPermission,
  ServerTemplate,
  ServerTier,
} from "@/types/server";

import { INITIAL_SERVERS, makeServer } from "../_Components/_Servers/utils/mockServers";
import { YOU_ID } from "../_Components/_Servers/utils/permissions";

export interface VoiceSession {
  serverId: string;
  channelId: string;
}

/**
 * Client-only state for the community servers UI. Everything here is a stand-in for
 * calls the chat service will eventually serve; each action maps to one future endpoint.
 */
export function useServersState() {
  const [servers, setServers] = useState<CommunityServer[]>(INITIAL_SERVERS);
  const [viewAs, setViewAs] = useState<ServerTier>("owner");
  const [voice, setVoice] = useState<VoiceSession | null>(null);
  /** Unread count per channel id. */
  const [unread, setUnread] = useState<Record<string, number>>({ "squad-chat": 4 });

  const patch = useCallback((serverId: string, fn: (s: CommunityServer) => CommunityServer) => {
    setServers((all) => all.map((s) => (s.id === serverId ? fn(s) : s)));
  }, []);

  /** POST /servers */
  const createServer = useCallback((name: string, template: ServerTemplate, iconUrl?: string) => {
    const created = makeServer(name, template, iconUrl);

    setServers((all) => [...all, created]);
    setViewAs("owner");

    return created;
  }, []);

  /** PATCH /servers/{id} */
  const renameServer = useCallback(
    (serverId: string, name: string) => patch(serverId, (s) => ({ ...s, name })),
    [patch],
  );

  /** PUT /servers/{id}/icon (multipart upload) or DELETE to remove it */
  const setServerIcon = useCallback(
    (serverId: string, iconUrl: string | undefined) => patch(serverId, (s) => ({ ...s, iconUrl })),
    [patch],
  );

  /** DELETE /servers/{id} (owner) or POST /servers/{id}/leave */
  const removeServer = useCallback((serverId: string) => {
    setServers((all) => all.filter((s) => s.id !== serverId));
    setVoice((v) => (v?.serverId === serverId ? null : v));
  }, []);

  /** POST /servers/{id}/channels */
  const addChannel = useCallback(
    (serverId: string, channel: ServerChannel) =>
      patch(serverId, (s) => ({ ...s, channels: [...s.channels, channel] })),
    [patch],
  );

  /** PATCH /channels/{id} */
  const updateChannel = useCallback(
    (serverId: string, channelId: string, changes: Partial<Omit<ServerChannel, "id">>) =>
      patch(serverId, (s) => ({
        ...s,
        channels: s.channels.map((c) => (c.id === channelId ? { ...c, ...changes } : c)),
      })),
    [patch],
  );

  /** DELETE /channels/{id} */
  const deleteChannel = useCallback(
    (serverId: string, channelId: string) => {
      patch(serverId, (s) => {
        const { [channelId]: _removed, ...messages } = s.messages;

        return { ...s, channels: s.channels.filter((c) => c.id !== channelId), messages };
      });
      setVoice((v) => (v?.channelId === channelId ? null : v));
    },
    [patch],
  );

  /** PUT /channels/{id}/read */
  const markChannelRead = useCallback(
    (channelId: string) =>
      setUnread((u) => {
        const { [channelId]: _cleared, ...rest } = u;

        return rest;
      }),
    [],
  );

  /** POST /channels/{id}/messages */
  const sendMessage = useCallback(
    (serverId: string, channelId: string, body: string) => {
      const message: ServerMessage = {
        id: `m${Date.now()}`,
        authorId: YOU_ID,
        body,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };

      patch(serverId, (s) => ({
        ...s,
        messages: { ...s.messages, [channelId]: [...(s.messages[channelId] ?? []), message] },
      }));
    },
    [patch],
  );

  /** PUT /servers/{id}/roles/{roleId} */
  const togglePermission = useCallback(
    (serverId: string, roleId: string, permission: ServerPermission) =>
      patch(serverId, (s) => ({
        ...s,
        roles: s.roles.map((r) =>
          r.id !== roleId
            ? r
            : {
                ...r,
                permissions: r.permissions.includes(permission)
                  ? r.permissions.filter((p) => p !== permission)
                  : [...r.permissions, permission],
              },
        ),
      })),
    [patch],
  );

  /** DELETE /servers/{id}/members/{userId} (kick) or PUT /bans/{userId} */
  const removeMember = useCallback(
    (serverId: string, memberId: string) =>
      patch(serverId, (s) => ({ ...s, members: s.members.filter((m) => m.id !== memberId) })),
    [patch],
  );

  const joinVoice = useCallback((serverId: string, channelId: string) => setVoice({ serverId, channelId }), []);
  const leaveVoice = useCallback(() => setVoice(null), []);

  return {
    servers,
    viewAs,
    setViewAs,
    voice,
    createServer,
    renameServer,
    setServerIcon,
    removeServer,
    addChannel,
    updateChannel,
    deleteChannel,
    unread,
    markChannelRead,
    sendMessage,
    togglePermission,
    removeMember,
    joinVoice,
    leaveVoice,
  };
}

export type ServersState = ReturnType<typeof useServersState>;
