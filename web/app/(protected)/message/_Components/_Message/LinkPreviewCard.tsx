"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { LinkPreview } from "@/types/linkPreview";

const PROVIDER_LABEL = { tiktok: "TikTok", twitter: "X" } as const;

async function fetchPreview(url: string): Promise<LinkPreview> {
  const res = await fetch(`/api/link-preview?${new URLSearchParams({ url })}`);

  if (!res.ok) throw new Error("no preview");

  return res.json();
}

/**
 * TikTok / X link card content (the board behind it comes from MessageEmbeds).
 * The text and picture open the original post; an X video plays right here. The data comes from our server
 * (which asks the site's oEmbed endpoint), and a failed lookup renders nothing.
 */
export function LinkPreviewCard({ url }: { url: string }) {
  const [imageBroken, setImageBroken] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["link-preview", url],
    queryFn: () => fetchPreview(url),
    staleTime: Infinity,
    retry: 1,
  });

  if (isError) return null;

  if (!data)
    return (
      <div className="h-16 w-full animate-pulse rounded-small bg-default-100" />
    );

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
  );
}
