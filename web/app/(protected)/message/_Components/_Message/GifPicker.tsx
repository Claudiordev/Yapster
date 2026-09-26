"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";

import { useGifLibrary } from "@/app/(protected)/message/_Actions/useGifLibrary";
import { Icon } from "@/components/Icon/Icon";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";
import type { Gif, GifPage, SavedGif } from "@/types/gif";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_FOLDER_NAME_LENGTH = 30;

/** Tab ids besides the folder ids. */
const TRENDING = "trending";
const NEW_FOLDER = "new";

/** One page of trending (empty query) or search results from the server route. */
async function loadGifs(
  query: string,
  page: number,
  signal: AbortSignal,
): Promise<GifPage> {
  const params = new URLSearchParams({ page: String(page) });

  if (query) params.set("q", query);

  const res = await fetch(`/api/gifs?${params}`, { signal });

  if (!res.ok) throw new Error("GIFs unavailable");

  return (await res.json()) as GifPage;
}

interface GifPickerProps {
  isDisabled?: boolean;
  /** Applied to the trigger button so it matches the Send button's style exactly (see COMPOSER_ACTION_BUTTON_CLASS). */
  triggerClassName?: string;
  onSelect: (gifUrl: string) => void;
}

function tabClass(active: boolean) {
  return `flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-medium border px-3 py-1.5 text-tiny font-medium transition-colors ${
    active
      ? "border-brand bg-brand text-white"
      : "border-divider bg-default-100 text-default-500 hover:bg-default-200 hover:text-foreground"
  }`;
}

export function GifPicker({
  isDisabled,
  triggerClassName,
  onSelect,
}: GifPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState(TRENDING);
  const [query, setQuery] = useState("");

  const library = useGifLibrary();
  const { load: loadLibrary, fetchFolderGifs } = library;

  // Trending / search results (paged).
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const loadingMore = useRef(false);

  // A folder's GIFs (the whole folder at once; it is small).
  const [folderGifs, setFolderGifs] = useState<SavedGif[]>([]);
  const [folderStatus, setFolderStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<SavedGif | null>(null);
  const [newName, setNewName] = useState("");
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const folders = library.library?.folders ?? [];
  const activeFolder = folders.find((f) => f.id === tab) ?? null;
  const onFolderTab = activeFolder !== null;
  const extraFolders = folders.filter((f) => !f.isDefault).length;
  const maxExtraFolders = library.library?.maxExtraFolders ?? 0;

  function resetView(nextTab: string) {
    setTab(nextTab);
    setQuery("");
    setNotice(null);
    setRenameDraft(null);
    setConfirmingDelete(false);
  }

  // Refresh the user's library each time the modal opens.
  useEffect(() => {
    if (isOpen) void loadLibrary();
  }, [isOpen, loadLibrary]);

  // A folder tab whose folder is gone (deleted) falls back to trending.
  useEffect(() => {
    if (
      library.library &&
      tab !== TRENDING &&
      tab !== NEW_FOLDER &&
      !activeFolder
    )
      setTab(TRENDING);
  }, [library.library, tab, activeFolder]);

  // Trending / search: first page, immediately for trending, debounced while typing.
  useEffect(() => {
    if (!isOpen || tab !== TRENDING) return;

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setStatus("loading");
        loadGifs(query.trim(), 1, controller.signal)
          .then((result) => {
            setGifs(result.gifs);
            setHasNext(result.hasNext);
            setPage(1);
            setStatus("ready");
          })
          .catch((error) => {
            if (error.name !== "AbortError") setStatus("error");
          });
      },
      query.trim() ? SEARCH_DEBOUNCE_MS : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, tab, query]);

  // A folder's GIFs, filtered by the search box.
  useEffect(() => {
    if (!isOpen || !onFolderTab) return;

    const folderId = tab;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setFolderStatus("loading");
        fetchFolderGifs(folderId, query.trim(), controller.signal)
          .then((result) => {
            setFolderGifs(result);
            setFolderStatus("ready");
          })
          .catch((error) => {
            if (error.name !== "AbortError") setFolderStatus("error");
          });
      },
      query.trim() ? SEARCH_DEBOUNCE_MS : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // `onFolderTab` flips only with `tab`; the folder is refetched when the tab or query changes.
  }, [isOpen, tab, onFolderTab, query, fetchFolderGifs]);

  function loadMore() {
    if (
      tab !== TRENDING ||
      !hasNext ||
      loadingMore.current ||
      status !== "ready"
    )
      return;

    loadingMore.current = true;
    loadGifs(query.trim(), page + 1, new AbortController().signal)
      .then((result) => {
        setGifs((prev) => [
          ...prev,
          ...result.gifs.filter((g) => !prev.some((p) => p.id === g.id)),
        ]);
        setHasNext(result.hasNext);
        setPage(page + 1);
      })
      .catch(() => setHasNext(false))
      .finally(() => {
        loadingMore.current = false;
      });
  }

  /** Runs a library change; a refusal (e.g. limit reached) is shown as a notice. */
  function run(action: Promise<unknown>) {
    setNotice(null);
    action.catch((error: Error) => setNotice(error.message));
  }

  function pick(gif: { url: string }) {
    onSelect(gif.url);
    setIsOpen(false);
  }

  function toggleStar(gif: SavedGif) {
    if (!library.library) return;

    // With extra folders the user chooses where it goes; with only Favorites it is one click.
    if (folders.length > 1) {
      setSaving(gif);

      return;
    }

    const favorites = folders[0];

    if (favorites) {
      run(
        library.setInFolder(
          gif,
          favorites.id,
          !library.foldersOf(gif.id).includes(favorites.id),
        ),
      );
    }
  }

  function createFolder() {
    const name = newName.trim();

    if (!name) return;

    setNotice(null);
    library
      .createFolder(name)
      .then((folder) => {
        setNewName("");
        resetView(folder.id);
      })
      .catch((error: Error) => setNotice(error.message));
  }

  function saveRename() {
    const name = (renameDraft ?? "").trim();

    if (!activeFolder || !name) return;

    if (name === activeFolder.name) {
      setRenameDraft(null);

      return;
    }

    setNotice(null);
    library
      .renameFolder(activeFolder.id, name)
      .then(() => setRenameDraft(null))
      .catch((error: Error) => setNotice(error.message));
  }

  function deleteActiveFolder() {
    if (!activeFolder) return;

    setNotice(null);
    library
      .deleteFolder(activeFolder.id)
      .then(() => resetView(TRENDING))
      .catch((error: Error) => setNotice(error.message));
  }

  // Un-starring inside a folder removes the tile straight away.
  const folderTiles = onFolderTab
    ? folderGifs.filter((g) => library.foldersOf(g.id).includes(tab))
    : [];
  const tiles: SavedGif[] = onFolderTab ? folderTiles : gifs;
  const tilesStatus = onFolderTab ? folderStatus : status;

  return (
    <Popover
      isOpen={isOpen}
      motionProps={POPUP_MOTION_PROPS}
      placement="top-end"
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setQuery("");
          setSaving(null);
          setNotice(null);
          setRenameDraft(null);
          setConfirmingDelete(false);
        }
      }}
    >
      <PopoverTrigger>
        <Button
          aria-label="Send a GIF"
          className={triggerClassName}
          isDisabled={isDisabled}
          // The popup is anchored to this button, so it must not scale/shift
          // on press (HeroUI's press animation) or the popup jumps as it opens.
          disableAnimation
          isIconOnly
          size="sm"
          variant="light"
        >
          <Icon name="gif" size={18} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[30rem] max-w-[calc(100vw-1.5rem)] p-0">
        <div className="relative flex w-full flex-col gap-3 p-3">
          {/* Tabs: Trending, Favorites, the user's folders, and "new folder". */}
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
            <button
              className={tabClass(tab === TRENDING)}
              type="button"
              onClick={() => resetView(TRENDING)}
            >
              Trending
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                className={tabClass(tab === folder.id)}
                type="button"
                onClick={() => resetView(folder.id)}
              >
                <Icon name={folder.isDefault ? "star" : "folder"} size={12} />
                <span className="max-w-[8rem] truncate">{folder.name}</span>
                <span className="opacity-70">{folder.gifCount}</span>
              </button>
            ))}
            {library.library && (
              <button
                aria-label="New folder"
                className={tabClass(tab === NEW_FOLDER)}
                title={
                  maxExtraFolders === 0
                    ? "Folders are a Premium feature"
                    : "New folder"
                }
                type="button"
                onClick={() => resetView(NEW_FOLDER)}
              >
                <Icon
                  name={maxExtraFolders === 0 ? "lock" : "plus"}
                  size={12}
                />
                {folders.length <= 1 && <span>Folder</span>}
              </button>
            )}
          </div>

          {library.failed && !library.library && (
            <p className="text-tiny text-default-400">
              Favorites and folders are unavailable right now ({library.failed}
              ).
            </p>
          )}

          {tab !== NEW_FOLDER && (
            <Input
              aria-label={
                onFolderTab ? `Search ${activeFolder.name}` : "Search GIFs"
              }
              autoFocus
              placeholder={
                onFolderTab ? `Search ${activeFolder.name}` : "Search KLIPY"
              }
              size="sm"
              startContent={
                <Icon className="text-default-400" name="search" size={14} />
              }
              value={query}
              variant="flat"
              onValueChange={setQuery}
            />
          )}

          {/* Rename / delete for the open custom folder. */}
          {onFolderTab && !activeFolder.isDefault && (
            <div className="flex items-center gap-2">
              {renameDraft !== null ? (
                <Input
                  aria-label="Folder name"
                  autoFocus
                  className="flex-1"
                  maxLength={MAX_FOLDER_NAME_LENGTH}
                  size="sm"
                  value={renameDraft}
                  variant="bordered"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveRename();
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setRenameDraft(null);
                    }
                  }}
                  onValueChange={setRenameDraft}
                />
              ) : (
                <p className="min-w-0 flex-1 truncate text-small font-semibold text-foreground">
                  {activeFolder.name}
                </p>
              )}

              {confirmingDelete ? (
                <>
                  <span className="text-tiny text-default-500">
                    Delete it and its {activeFolder.gifCount} GIFs?
                  </span>
                  <Button
                    color="danger"
                    size="sm"
                    variant="flat"
                    onPress={deleteActiveFolder}
                  >
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : renameDraft !== null ? (
                <>
                  <Button
                    color="primary"
                    size="sm"
                    variant="flat"
                    onPress={saveRename}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => setRenameDraft(null)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    isIconOnly
                    aria-label="Rename folder"
                    size="sm"
                    variant="light"
                    onPress={() => setRenameDraft(activeFolder.name)}
                  >
                    <Icon name="edit" size={14} />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label="Delete folder"
                    size="sm"
                    variant="light"
                    onPress={() => setConfirmingDelete(true)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                </>
              )}
            </div>
          )}

          {tab === NEW_FOLDER ? (
            <div className="flex h-[22rem] flex-col items-center justify-center gap-3 px-6 text-center">
              {maxExtraFolders === 0 ? (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-default-100 text-default-500">
                    <Icon name="lock" size={22} />
                  </span>
                  <p className="text-small font-semibold text-foreground">
                    Folders are a Premium feature
                  </p>
                  <p className="text-tiny text-default-400">
                    Premium members can sort their GIFs into their own folders.
                    Everyone can save GIFs to Favorites with the star.
                  </p>
                </>
              ) : extraFolders >= maxExtraFolders ? (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-default-100 text-default-500">
                    <Icon name="folder" size={22} />
                  </span>
                  <p className="text-small font-semibold text-foreground">
                    You&apos;ve used all {maxExtraFolders} folders
                  </p>
                  <p className="text-tiny text-default-400">
                    Delete a folder to make room for a new one.
                  </p>
                </>
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <Icon name="folder" size={22} />
                  </span>
                  <p className="text-small font-semibold text-foreground">
                    New folder
                  </p>
                  <p className="text-tiny text-default-400">
                    {extraFolders} of {maxExtraFolders} extra folders used
                  </p>
                  <div className="flex w-full max-w-xs items-center gap-2">
                    <Input
                      aria-label="Folder name"
                      autoFocus
                      maxLength={MAX_FOLDER_NAME_LENGTH}
                      placeholder="Folder name"
                      size="sm"
                      value={newName}
                      variant="bordered"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") createFolder();
                      }}
                      onValueChange={setNewName}
                    />
                    <Button
                      color="primary"
                      isDisabled={!newName.trim()}
                      size="sm"
                      onPress={createFolder}
                    >
                      Create
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div
              className="grid h-[22rem] auto-rows-[9rem] grid-cols-3 content-start gap-2 overflow-y-auto"
              onScroll={(event) => {
                const el = event.currentTarget;

                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120)
                  loadMore();
              }}
            >
              {tiles.map((gif) => {
                const saved = library.foldersOf(gif.id).length > 0;

                return (
                  <div
                    key={gif.id}
                    className="group relative h-full overflow-hidden rounded-medium bg-default-100"
                  >
                    <button
                      aria-label={`Send ${gif.title}`}
                      className="h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      type="button"
                      onClick={() => pick(gif)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- external GIF */}
                      <img
                        alt={gif.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={gif.previewUrl}
                      />
                    </button>
                    {library.library && (
                      <button
                        aria-label={
                          saved ? "Saved: change folders" : "Save GIF"
                        }
                        aria-pressed={saved}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                        type="button"
                        onClick={() => toggleStar(gif)}
                      >
                        <Icon
                          className={saved ? "text-warning" : ""}
                          name={saved ? "star" : "star-outline"}
                          size={14}
                        />
                      </button>
                    )}
                  </div>
                );
              })}

              {tilesStatus === "loading" && (
                <p className="col-span-3 py-10 text-center text-tiny text-default-400">
                  Loading…
                </p>
              )}
              {tilesStatus === "error" && (
                <p className="col-span-3 py-10 text-center text-tiny text-default-400">
                  {onFolderTab
                    ? "Couldn't load this folder"
                    : "GIFs unavailable right now"}
                </p>
              )}
              {tilesStatus === "ready" && tiles.length === 0 && (
                <p className="col-span-3 py-10 text-center text-tiny text-default-400">
                  {query.trim()
                    ? "No GIFs found"
                    : onFolderTab
                      ? "Nothing here yet. Star a GIF to save it."
                      : "No GIFs found"}
                </p>
              )}
            </div>
          )}

          {notice && (
            <p
              className="rounded-medium bg-danger/15 px-3 py-2 text-tiny text-danger"
              role="alert"
            >
              {notice}
            </p>
          )}

          {/* "Save to…": pick which folders hold the GIF (only when there is more than Favorites). */}
          {saving && (
            <div className="absolute inset-0 z-10 flex flex-col gap-3 rounded-large bg-content1 p-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- external GIF */}
                <img
                  alt=""
                  className="h-14 w-14 rounded-medium object-cover"
                  src={saving.previewUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-small font-semibold text-foreground">
                    Save to…
                  </p>
                  <p className="truncate text-tiny text-default-400">
                    {saving.title}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setSaving(null)}
                >
                  Done
                </Button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
                {folders.map((folder) => {
                  const included = library
                    .foldersOf(saving.id)
                    .includes(folder.id);

                  return (
                    <button
                      key={folder.id}
                      aria-pressed={included}
                      className={`flex items-center gap-3 rounded-medium border px-3 py-2.5 text-left transition-colors ${
                        included
                          ? "border-brand bg-brand/10"
                          : "border-divider bg-default-50 hover:bg-default-100"
                      }`}
                      type="button"
                      onClick={() =>
                        run(library.setInFolder(saving, folder.id, !included))
                      }
                    >
                      <Icon
                        className={included ? "text-brand" : "text-default-400"}
                        name={folder.isDefault ? "star" : "folder"}
                        size={16}
                      />
                      <span className="min-w-0 flex-1 truncate text-small text-foreground">
                        {folder.name}
                      </span>
                      <span className="text-tiny text-default-400">
                        {folder.gifCount}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          included
                            ? "bg-brand text-white"
                            : "border border-default-300"
                        }`}
                      >
                        {included && <Icon name="check" size={12} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {notice && (
                <p
                  className="rounded-medium bg-danger/15 px-3 py-2 text-tiny text-danger"
                  role="alert"
                >
                  {notice}
                </p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
