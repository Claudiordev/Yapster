"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  hasPreviewContent,
  linkPreviewQuery,
} from "@/app/(protected)/message/_Actions/useEmbedReady";
import type { LinkPreview } from "@/types/linkPreview";

const PROVIDER_LABEL = { tiktok: "TikTok", twitter: "X" } as const;

/** Left-bar colour per site: X blue, TikTok purple, other websites neutral. */
const ACCENT = {
  twitter: "border-l-[#1d9bf0]",
  tiktok: "border-l-[#8b5cf6]",
  site: "border-l-default-400",
} as const;

/** The "board" behind a link preview: sidebar-coloured surface, coloured bar on the left. */
function Board({
  provider,
  children,
}: {
  provider: LinkPreview["provider"];
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-1.5 w-full max-w-[520px] rounded-medium border border-divider border-l-[6px] ${ACCENT[provider]} bg-content1 px-4 py-5 dark:bg-surface-sidebar`}
    >
      {children}
    </div>
  );
}

/**
 * Card content for any other website: its title, description and picture, from the page's Open Graph tags.
 * The picture loads straight from the site's own host in the reader's browser (no Referer is sent).
 * A link that is itself a picture (`directImage`) is just that picture, with no card text.
 */
function SiteCard({ data, url }: { data: LinkPreview; url: string }) {
  const [imageBroken, setImageBroken] = useState(false);
  const image =
    data.imageUrl && !imageBroken ? (
      <a href={url} rel="noopener noreferrer" target="_blank">
        {/* eslint-disable-next-line @next/next/no-img-element -- external picture */}
        <img
          alt=""
          className="mt-2 h-auto max-h-72 w-full rounded-small object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={data.imageUrl}
          onError={() => setImageBroken(true)}
        />
      </a>
    ) : null;

  return (
    <div className="flex w-full min-w-0 flex-col px-1 py-0.5 text-left">
      <a
        className="flex min-w-0 flex-col gap-1"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {data.author && (
          <p className="truncate text-tiny text-default-400">{data.author}</p>
        )}
        {data.title && (
          <p className="text-sm font-semibold text-brand [overflow-wrap:anywhere] hover:underline">
            {data.title}
          </p>
        )}
        {data.text && (
          <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground [overflow-wrap:anywhere]">
            {data.text}
          </p>
        )}
      </a>
      {image}
    </div>
  );
}

/**
 * TikTok / X / website link card, on its board. A direct image link renders bare, without the board.
 * The text and picture open the original post; an X video plays right here. The data comes from our server
 * (which asks the site's oEmbed endpoint), and a failed lookup renders nothing.
 */
export function LinkPreviewCard({
  url,
  provider,
}: {
  url: string;
  provider: LinkPreview["provider"];
}) {
  const [imageBroken, setImageBroken] = useState(false);
  const { data, isError } = useQuery(linkPreviewQuery(url));

  if (isError || (data && !hasPreviewContent(data))) return null;

  // Generic links often have nothing to show, so no placeholder: the card just appears.
  if (!data) {
    return provider === "site" ? null : (
      <Board provider={provider}>
        <div className="h-16 w-full animate-pulse rounded-small bg-default-100" />
      </Board>
    );
  }

  if (data.provider === "site") {
    if (data.directImage) {
      if (!data.imageUrl || imageBroken) return null;

      return (
        <a
          className="mt-1.5 block w-fit max-w-[360px]"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- external picture */}
          <img
            alt=""
            className="h-auto max-h-[300px] w-auto rounded-medium object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={data.imageUrl}
            onError={() => setImageBroken(true)}
          />
        </a>
      );
    }

    return (
      <Board provider="site">
        <SiteCard data={data} url={url} />
      </Board>
    );
  }

  const media = data.videoUrl ? (
    // Outside the link so the player's own clicks (play, seek, fullscreen) never open the post.
    // Loaded directly from X's CDN, which refuses requests carrying another site's Referer: the
    // messages page sends none (Referrer-Policy header in next.config.js).
    <video
      className="mt-2 max-h-[28rem] w-full rounded-small bg-black"
      controls
      playsInline
      poster={data.thumbnailUrl}
      preload="none"
      src={data.videoUrl}
    />
  ) : data.photoUrls ? (
    <div
      className={`mt-2 grid gap-1 ${data.photoUrls.length > 1 ? "grid-cols-2" : ""}`}
    >
      {data.photoUrls.map((photo) => (
        <a key={photo} href={url} rel="noopener noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element -- external photo */}
          <img
            alt=""
            className="h-auto max-h-[28rem] w-full rounded-small object-contain"
            loading="lazy"
            src={photo}
          />
        </a>
      ))}
    </div>
  ) : data.thumbnailUrl && !imageBroken ? (
    <a href={url} rel="noopener noreferrer" target="_blank">
      {/* eslint-disable-next-line @next/next/no-img-element -- external thumbnail */}
      <img
        alt=""
        className="mt-2 h-auto max-h-[28rem] w-full rounded-small object-contain"
        loading="lazy"
        src={data.thumbnailUrl}
        onError={() => setImageBroken(true)}
      />
    </a>
  ) : null;

  return (
    <Board provider={data.provider}>
      <div className="flex w-full min-w-0 flex-col px-1 py-0.5 text-left">
        <a
          className="flex min-w-0 flex-col gap-1"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          <p className="truncate text-tiny text-default-400">
            {PROVIDER_LABEL[data.provider]}
            {data.author && ` · ${data.author}`}
          </p>
          {data.text && (
            <p className="whitespace-pre-line text-sm text-foreground [overflow-wrap:anywhere]">
              {data.text}
            </p>
          )}
          {data.quote && (
            <div className="mt-1 border-l-2 border-default-300 pl-2">
              <p className="truncate text-tiny text-default-400">
                {data.quote.author}
              </p>
              <p className="whitespace-pre-line text-sm text-foreground [overflow-wrap:anywhere]">
                {data.quote.text}
              </p>
            </div>
          )}
        </a>
        {media}
      </div>
    </Board>
  );
}
