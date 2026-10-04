"use client";

import { queryOptions, useQueries } from "@tanstack/react-query";

import { embedsForBody } from "@/app/(protected)/message/_Components/_Message/utils/embeds";
import type { LinkPreview } from "@/types/linkPreview";

/** Shared by the embed components and `useEmbedReady`, so both read one cache entry per link. */
export function linkPreviewQuery(url: string) {
  return queryOptions({
    queryKey: ["link-preview", url],
    queryFn: async (): Promise<LinkPreview> => {
      const res = await fetch(
        `/api/link-preview?${new URLSearchParams({ url })}`,
      );

      if (!res.ok) throw new Error("no preview");

      return res.json();
    },
    staleTime: Infinity,
    retry: 1,
  });
}

interface YouTubeOEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

export function youTubeOEmbedQuery(url: string, videoId: string) {
  return queryOptions({
    queryKey: ["youtube-oembed", videoId],
    queryFn: async (): Promise<YouTubeOEmbed> => {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      );

      if (!res.ok) throw new Error("oembed failed");

      return res.json();
    },
    staleTime: Infinity,
    retry: 1,
  });
}

/** Whether a fetched link preview has anything to draw (a bare site with no tags renders nothing). */
export function hasPreviewContent(data: LinkPreview): boolean {
  if (data.provider !== "site") return true;
  if (data.directImage) return Boolean(data.imageUrl);

  return Boolean(data.title || data.text || data.imageUrl);
}

/**
 * True once a message that is just one link (nothing else in the body) has a
 * preview on screen, so the link text can be left out. Stays false while the
 * preview loads or if it fails: the link then remains the only thing to click.
 */
export function useEmbedReady(body: string, enabled: boolean): boolean {
  const [embed] = embedsForBody(body);
  const soleLink = embed !== undefined && body.trim() === embed.url;

  const [result] = useQueries({
    queries: [
      embed?.type === "youtube"
        ? {
            ...youTubeOEmbedQuery(embed.url, embed.videoId),
            enabled: soleLink && enabled,
          }
        : {
            ...linkPreviewQuery(embed?.url ?? ""),
            enabled: soleLink && enabled && embed?.type === "linkCard",
          },
    ],
  });

  if (!soleLink || !enabled || !result.data) return false;

  return embed.type === "linkCard"
    ? hasPreviewContent(result.data as LinkPreview)
    : true;
}
