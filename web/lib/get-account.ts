import { cookies } from "next/headers";

import { API_BASE_URL, AUTH_COOKIE_NAME } from "@/lib/constants";

interface SessionUser {
  id: string;
  username: string;
  balance?: number;
  avatarUrl?: string | null;
}

export interface Account {
  username: string;
  balance: number;
  avatarUrl: string | null;
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
    const res = await fetch(`${API_BASE_URL}/user`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const user = (await res.json()) as SessionUser;

    return {
      username: user.username,
      balance: user.balance ?? 0,
      avatarUrl: user.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}
