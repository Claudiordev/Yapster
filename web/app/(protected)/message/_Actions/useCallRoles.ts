"use client";

import { useEffect, useState } from "react";

import type { PlatformUser } from "@/types/user";

/**
 * The current roles of the people in a call, so badges and admin-only controls
 * there aren't stuck on whatever the conversation list loaded earlier.
 *
 * It re-reads only when the SET of participants changes (someone joins or
 * leaves, or you connect) — no polling, and no server-side broadcast: the cost
 * is one small batched request per join/leave, bounded by the call's size.
 * A failed read keeps the previous roles.
 */
export function useCallRoles(userIds: string[]): Record<string, string[]> {
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const key = [...userIds].sort().join(",");

  useEffect(() => {
    if (!key) {
      setRoles({});

      return;
    }

    const controller = new AbortController();

    fetch(`/api/users?ids=${key}`, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<PlatformUser[]>) : Promise.reject()))
      .then((users) =>
        setRoles(Object.fromEntries(users.map((user) => [user.id, user.roles]))),
      )
      .catch(() => {
        // keep what we had; the next join/leave tries again
      });

    return () => controller.abort();
  }, [key]);

  return roles;
}
