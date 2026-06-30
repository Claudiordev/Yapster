"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/constants";

interface Account {
  username: string | null;
  balance: number | null;
  avatarUrl: string | null;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<Account | null>(null);

interface AccountProviderProps {
  initialUsername: string | null;
  initialBalance: number | null;
  initialAvatarUrl: string | null;
  children: ReactNode;
}

/**
 * Shares the logged-in user with every `useAccount()` consumer. The data is
 * fetched on the SERVER (see `getAccount`) and passed in via `initialUsername`
 * / `initialBalance`, so it's present on first paint with no client round-trip
 * and no duplicate requests. `refresh()` re-pulls it client-side after actions
 * that change it (e.g. balance after sending a paid message).
 */
export function AccountProvider({
  initialUsername,
  initialBalance,
  initialAvatarUrl,
  children,
}: AccountProviderProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");

      if (!res.ok) return;
      const data = await res.json();

      if (data?.username) setUsername(data.username);
      if (typeof data?.balance === "number") setBalance(data.balance);
      setAvatarUrl(data?.avatarUrl ?? null);
    } catch {
      // ignore — keep whatever we already have
    }
  }, []);

  // If the server didn't seed a username (null or ""), load it client-side
  // from /api/auth/me so the profile bar shows the name + avatar once /user
  // resolves.
  const needsClientFetch = !initialUsername;

  useEffect(() => {
    if (needsClientFetch) refresh();
  }, [needsClientFetch, refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(ROUTES.LOGIN);
    router.refresh();
  }, [router]);

  return (
    <AccountContext.Provider
      value={{ username, balance, avatarUrl, logout, refresh }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): Account {
  const ctx = useContext(AccountContext);

  if (!ctx) {
    throw new Error("useAccount must be used within an AccountProvider");
  }

  return ctx;
}
