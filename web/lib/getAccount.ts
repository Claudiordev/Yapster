import { cookies } from "next/headers";

import { toRelativeAvatar } from "@/lib/avatar";
import { rolesFromClaims, verifyJwt } from "@/lib/auth";
import { API_BASE_URL, AUTH_COOKIE_NAME } from "@/lib/constants";
import type { Account, FeatureFlags, SessionUser } from "@/types/user";

/** Feature switches; unreadable means everything reads as off rather than failing the page. */
async function fetchFeatures(token: string): Promise<FeatureFlags> {
  try {
    const res = await fetch(`${API_BASE_URL}/features`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    return res.ok ? ((await res.json()) as FeatureFlags) : {};
  } catch {
    return {};
  }
}

/**
 * Server-side fetch of the logged-in user, used to seed the client
 * AccountProvider on first paint (no client round-trip, no loading flash).
 *
 * Reads the auth cookie directly — it does NOT refresh, because Server
 * Components can't set cookies; middleware has already validated/renewed the
 * token before the page renders. Uses `no-store` so this per-user response is
 * never cached.
 */
export async function getAccount(): Promise<Account | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const [res, claims, features] = await Promise.all([
      fetch(`${API_BASE_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
      verifyJwt(token),
      fetchFeatures(token),
    ]);

    if (!res.ok) return null;

    const user = (await res.json()) as SessionUser;

    return {
      userId: user.id,
      username: user.username,
      balance: user.balance ?? 0,
      avatarUrl: toRelativeAvatar(user.avatarUrl),
      // The DB is the source of truth; the JWT claim can lag a role change by
      // up to one access-token lifetime. Fall back to it only if /user omits roles.
      roles: Array.isArray(user.roles) ? user.roles : rolesFromClaims(claims),
      features,
    };
  } catch {
    return null;
  }
}
