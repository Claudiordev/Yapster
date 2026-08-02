"use client";

import { useCallback, useEffect, useState } from "react";

import type { PlatformUser } from "@/app/api/users/search/route";

const PAGE_SIZE = 20;

interface UserSearchState {
  users: PlatformUser[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * Paginated search of platform users via the session service
 * (`/api/users/search`). Fetches whenever the query changes — a stale response
 * is discarded by the effect's `active` guard. A blank query clears the
 * results. `loadMore` pulls the next page and appends; `hasMore` is true while a
 * full page keeps coming back.
 */
export function useUserSearch(query: string): UserSearchState {
  const trimmed = query.trim();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Reset + (debounced) fetch the first page whenever the query changes.
  useEffect(() => {
    if (!trimmed) {
      setUsers([]);
      setHasMore(false);
      setPage(0);

      return;
    }

    let active = true;

    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/users/search?query=${encodeURIComponent(trimmed)}&page=0&size=${PAGE_SIZE}`,
        );
        const data: PlatformUser[] = res.ok ? await res.json() : [];

        if (!active) return;
        setUsers(data);
        setPage(0);
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        if (active) {
          setUsers([]);
          setHasMore(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [trimmed]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !trimmed) return;

    const next = page + 1;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/users/search?query=${encodeURIComponent(trimmed)}&page=${next}&size=${PAGE_SIZE}`,
      );
      const data: PlatformUser[] = res.ok ? await res.json() : [];

      setUsers((prev) => [...prev, ...data]);
      setPage(next);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, trimmed, page]);

  return { users, loading, hasMore, loadMore };
}
