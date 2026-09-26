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
import type { FeatureFlags } from "@/types/user";

interface AccountContextValue {
  userId: string | null;
  username: string | null;
  balance: number | null;
  state: string | null;
  avatarUrl: string | null;
  roles: string[];
  /** Admin-controlled feature switches, read at login. A feature missing from the map is off. */
  features: FeatureFlags;
  isFeatureEnabled: (feature: string) => boolean;
  /** Replaces the held switches (after an admin saves them). */
  setFeatures: (features: FeatureFlags) => void;
  logout: () => Promise<void>;
  /** Re-reads the account from the server; resolves with the fresh roles, or null on failure. */
  refresh: () => Promise<string[] | null>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

interface AccountProviderProps {
  initialUserId: string | null;
  initialUsername: string | null;
  initialBalance: number | null;
  initialAvatarUrl: string | null;
  initialRoles: string[];
  initialFeatures: FeatureFlags;
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
  initialUserId,
  initialUsername,
  initialBalance,
  initialAvatarUrl,
  initialRoles,
  initialFeatures,
  children,
}: AccountProviderProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [features, setFeatures] = useState<FeatureFlags>(initialFeatures);
  const [state] = useState<string | null>("Online");

  const refresh = useCallback(async (): Promise<string[] | null> => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });

      if (!res.ok) return null;
      const data = await res.json();

      if (data?.id) setUserId(data.id);
      if (data?.username) setUsername(data.username);
      if (typeof data?.balance === "number") setBalance(data.balance);
      setAvatarUrl(data?.avatarUrl ?? null);
      if (Array.isArray(data?.roles)) {
        setRoles(data.roles);

        return data.roles;
      }

      return null;
    } catch {
      // ignore — keep whatever we already have
      return null;
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
      value={{
        userId,
        username,
        balance,
        state,
        avatarUrl,
        roles,
        features,
        isFeatureEnabled: (feature: string) => features[feature] === true,
        setFeatures,
        logout,
        refresh,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);

  if (!ctx) {
    throw new Error("useAccount must be used within an AccountProvider");
  }

  return ctx;
}
