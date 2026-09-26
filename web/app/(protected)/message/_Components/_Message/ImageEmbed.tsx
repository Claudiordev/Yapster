"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";

import { useGifLibrary } from "@/app/(protected)/message/_Actions/useGifLibrary";
import { Icon } from "@/components/Icon/Icon";
import { POPUP_MOTION_PROPS } from "@/lib/popupMotion";
import { gifIdFromUrl } from "./utils/gifId";

/** Direct image/GIF link preview — renders inline like Discord does, no fetch needed. */
export function ImageEmbed({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  const [requested, setRequested] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const box = useRef<HTMLDivElement>(null);
  const { library, load, foldersOf, setInFolder } = useGifLibrary();

  // A GIF scrolled out of view is unloaded so it stops animating; it restarts (from cache) on return.
  useEffect(() => {
    const el = box.current;

    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "200px" },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [broken]);

  if (broken) return null;

  const favorites = library?.folders[0];
  const gif = { id: gifIdFromUrl(url), title: "GIF", previewUrl: url, url };
  const saved = foldersOf(gif.id).length > 0;

  // The library is fetched on the first hover, not for every GIF in the thread.
  function ensureLibrary() {
    if (requested) return;
    setRequested(true);
    void load();
  }

  const folders = library?.folders ?? [];
  const starClass = `flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100 ${
    menuOpen ? "opacity-100" : "opacity-0"
  }`;
  const starIcon = (
    <Icon
      className={saved ? "text-warning" : ""}
      name={saved ? "star" : "star-outline"}
      size={14}
    />
  );

  /** A GIF put in any folder is also kept in Favorites (the first folder). */
  function toggleFolder(folderId: string) {
    const add = !foldersOf(gif.id).includes(folderId);
    const favoritesId = folders[0]?.id;

    setNotice(null);
    setInFolder(gif, folderId, add)
      .then(() =>
        add &&
        favoritesId &&
        folderId !== favoritesId &&
        !foldersOf(gif.id).includes(favoritesId)
          ? setInFolder(gif, favoritesId, true)
          : undefined,
      )
      .catch((error: Error) => setNotice(error.message));
  }

  return (
    <div
      ref={box}
      className="group relative mt-1.5 w-fit max-w-[360px] overflow-hidden rounded-medium border border-divider"
      onMouseEnter={ensureLibrary}
    >
      <a href={url} rel="noopener noreferrer" target="_blank">
        {visible || !size ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unknown dimensions
          <img
            alt=""
            className="max-h-[300px] w-auto object-contain"
            loading="lazy"
            src={url}
            onError={() => setBroken(true)}
            onLoad={(event) =>
              setSize({
                width: event.currentTarget.offsetWidth,
                height: event.currentTarget.offsetHeight,
              })
            }
          />
        ) : (
          <span className="block" style={size} />
        )}
      </a>
      {favorites && (
        <div className="absolute right-1.5 top-1.5">
          <Popover
            isOpen={menuOpen}
            motionProps={POPUP_MOTION_PROPS}
            placement="bottom-end"
            onOpenChange={(open) => {
              setMenuOpen(open);
              if (!open) setNotice(null);
            }}
          >
            <PopoverTrigger>
              <Button
                aria-label={saved ? "Saved: change folders" : "Save GIF"}
                aria-pressed={saved}
                className={`${starClass} !h-7 !w-7 min-w-0 p-0`}
                disableAnimation
                isIconOnly
                size="sm"
                variant="light"
              >
                {starIcon}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 items-stretch gap-1 p-2">
              <p className="px-1 pb-1 text-tiny font-semibold text-default-500">
                Save to…
              </p>
              {folders.map((folder) => {
                const included = foldersOf(gif.id).includes(folder.id);

                return (
                  <button
                    key={folder.id}
                    aria-pressed={included}
                    className={`flex items-center gap-2 rounded-medium border px-2.5 py-1.5 text-left transition-colors ${
                      included
                        ? "border-brand bg-brand/10"
                        : "border-divider bg-default-50 hover:bg-default-100"
                    }`}
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <Icon
                      className={included ? "text-brand" : "text-default-400"}
                      name={folder.isDefault ? "star" : "folder"}
                      size={14}
                    />
                    <span className="min-w-0 flex-1 truncate text-small text-foreground">
                      {folder.name}
                    </span>
                    {included && (
                      <Icon className="text-brand" name="check" size={12} />
                    )}
                  </button>
                );
              })}
              {notice && (
                <p className="px-1 text-tiny text-danger" role="alert">
                  {notice}
                </p>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
