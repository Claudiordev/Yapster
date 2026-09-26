"use client";

import { useCallback, useState } from "react";

import { readProblemDetail } from "@/lib/problemDetails";
import type { GifFolder, GifLibrary, SavedGif } from "@/types/gif";

const BASE = "/api/gifs/library";

/** Throws an Error carrying the server's reason (e.g. "You can have up to 5 extra GIF folders"). */
async function ensureOk(res: Response, fallback: string) {
  if (!res.ok) throw new Error(await readProblemDetail(res, fallback));
}

/**
 * The signed-in user's saved GIFs: Favorites for everyone, more folders for Premium roles.
 * Star/unstar updates the screen first and rolls back if the server refuses.
 */
export function useGifLibrary() {
  const [library, setLibrary] = useState<GifLibrary | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(BASE, { cache: "no-store" });

      if (!res.ok) {
        setFailed(
          `${res.status} ${await readProblemDetail(res, res.statusText)}`.trim(),
        );

        return;
      }

      setLibrary((await res.json()) as GifLibrary);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Network error");
    }
  }, []);

  const foldersOf = useCallback(
    (gifId: string) => library?.memberships[gifId] ?? [],
    [library],
  );

  /** Saves the GIF into a folder, or takes it out. */
  const setInFolder = useCallback(
    async (gif: SavedGif, folderId: string, saved: boolean) => {
      const previous = library;

      setLibrary((current) =>
        current ? withMembership(current, gif.id, folderId, saved) : current,
      );

      try {
        const path = `${BASE}/folders/${encodeURIComponent(folderId)}/gifs/${encodeURIComponent(gif.id)}`;
        const res = await fetch(
          path,
          saved
            ? {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: gif.title,
                  previewUrl: gif.previewUrl,
                  url: gif.url,
                }),
              }
            : { method: "DELETE" },
        );

        await ensureOk(res, "Could not update your GIFs");
      } catch (error) {
        setLibrary(previous);
        throw error;
      }
    },
    [library],
  );

  const createFolder = useCallback(async (name: string): Promise<GifFolder> => {
    const res = await fetch(`${BASE}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    await ensureOk(res, "Could not create the folder");

    const folder = (await res.json()) as GifFolder;

    setLibrary((current) =>
      current ? { ...current, folders: [...current.folders, folder] } : current,
    );

    return folder;
  }, []);

  const renameFolder = useCallback(async (folderId: string, name: string) => {
    const res = await fetch(`${BASE}/folders/${encodeURIComponent(folderId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    await ensureOk(res, "Could not rename the folder");
    setLibrary((current) =>
      current
        ? {
            ...current,
            folders: current.folders.map((f) =>
              f.id === folderId ? { ...f, name: name.trim() } : f,
            ),
          }
        : current,
    );
  }, []);

  /** Deletes the folder and the GIFs in it. */
  const deleteFolder = useCallback(async (folderId: string) => {
    const res = await fetch(`${BASE}/folders/${encodeURIComponent(folderId)}`, {
      method: "DELETE",
    });

    await ensureOk(res, "Could not delete the folder");
    setLibrary((current) => {
      if (!current) return current;

      const memberships: Record<string, string[]> = {};

      for (const [gifId, folderIds] of Object.entries(current.memberships)) {
        const rest = folderIds.filter((id) => id !== folderId);

        if (rest.length > 0) memberships[gifId] = rest;
      }

      return {
        ...current,
        folders: current.folders.filter((f) => f.id !== folderId),
        memberships,
      };
    });
  }, []);

  const fetchFolderGifs = useCallback(
    async (
      folderId: string,
      query: string,
      signal: AbortSignal,
    ): Promise<SavedGif[]> => {
      const search = query ? `?${new URLSearchParams({ q: query })}` : "";
      const res = await fetch(
        `${BASE}/folders/${encodeURIComponent(folderId)}/gifs${search}`,
        {
          cache: "no-store",
          signal,
        },
      );

      await ensureOk(res, "Could not load the folder");

      return (await res.json()) as SavedGif[];
    },
    [],
  );

  return {
    library,
    failed,
    load,
    foldersOf,
    setInFolder,
    createFolder,
    renameFolder,
    deleteFolder,
    fetchFolderGifs,
  };
}

/** The library with the GIF added to / removed from one folder (memberships and counts). */
function withMembership(
  library: GifLibrary,
  gifId: string,
  folderId: string,
  saved: boolean,
): GifLibrary {
  const current = library.memberships[gifId] ?? [];
  const has = current.includes(folderId);

  if (saved === has) return library;

  const next = saved
    ? [...current, folderId]
    : current.filter((id) => id !== folderId);
  const memberships = { ...library.memberships };

  if (next.length > 0) memberships[gifId] = next;
  else delete memberships[gifId];

  return {
    ...library,
    memberships,
    folders: library.folders.map((f) =>
      f.id === folderId ? { ...f, gifCount: f.gifCount + (saved ? 1 : -1) } : f,
    ),
  };
}
