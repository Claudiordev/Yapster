"use client";

import { useCallback, useEffect, useRef } from "react";

import { setScreenShareRoles } from "@/lib/mediaPrefs";
import { useAccount } from "@/lib/hooks/useAccount";
import { useRealtime } from "@/lib/hooks/useRealtime";

const FOCUS_THROTTLE_MS = 30_000;

/** Same set regardless of order. */
function sameRoles(a: string[], b: string[]) {
  return a.length === b.length && a.every((role) => b.includes(role));
}

/**
 * Keeps the signed-in user's roles current without a relogin.
 *
 *  - The server pushes ROLES_CHANGED when an admin edits this user's roles.
 *  - Coming back to the tab re-checks too (throttled) — covers a missed push.
 *
 * Either way: re-read the account (roles come from the DB), and if they
 * differ from what we show, swap the access token so backend permission
 * checks — which read the JWT — match the new roles too. That token swap is
 * "soft": the server single-flights it per refresh token, and a failure keeps
 * the session cookies, so several tabs syncing at once can't log the user out.
 */
export function RolesSync() {
  const { roles, refresh } = useAccount();
  const { subscribe } = useRealtime();
  const rolesRef = useRef(roles);
  const inFlight = useRef<Promise<void> | null>(null);
  const lastCheck = useRef(0);

  useEffect(() => {
    rolesRef.current = roles;
    setScreenShareRoles(roles);
  }, [roles]);

  const sync = useCallback(
    (force: boolean) => {
      if (inFlight.current) return inFlight.current;

      const run = (async () => {
        const fresh = await refresh();

        lastCheck.current = Date.now();
        if (!fresh || (!force && sameRoles(fresh, rolesRef.current))) return;

        try {
          await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "x-soft-refresh": "1" },
          });
        } catch {
          // The normal expiry refresh will pick the new roles up anyway.
        }
      })().finally(() => {
        inFlight.current = null;
      });

      inFlight.current = run;

      return run;
    },
    [refresh],
  );

  useEffect(() => subscribe("ROLES_CHANGED", () => void sync(true)), [subscribe, sync]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastCheck.current < FOCUS_THROTTLE_MS) return;
      void sync(false);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [sync]);

  return null;
}
