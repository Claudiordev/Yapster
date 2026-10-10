"use client";

import { useMemo } from "react";

import { useAccount } from "@/lib/hooks/useAccount";

import { useServers } from "../_Components/ServersProvider";
import { membersWithYou, resolveAccess } from "../_Components/_Servers/utils/permissions";

/** One server plus what the previewed role may do in it and who is in it. */
export function useServerAccess(serverId: string | undefined) {
  const { servers, viewAs } = useServers();
  const { username } = useAccount();

  const server = useMemo(() => servers.find((s) => s.id === serverId) ?? null, [servers, serverId]);
  const access = useMemo(() => (server ? resolveAccess(server, viewAs) : null), [server, viewAs]);
  const members = useMemo(
    () => (server ? membersWithYou(server, viewAs, { username: username ?? "You" }) : []),
    [server, viewAs, username],
  );

  return { server, access, members, viewAs };
}
