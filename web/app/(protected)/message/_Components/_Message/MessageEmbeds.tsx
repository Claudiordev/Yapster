"use client";

import { embedsForBody } from "@/app/(protected)/message/_Components/_Message/utils/embeds";
import { ImageEmbed } from "./ImageEmbed";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { YouTubeEmbed } from "./YouTubeEmbed";

/** Left-bar colour per site: X blue, TikTok purple, everything else (YouTube) the brand colour. */
const ACCENT = {
  twitter: "border-l-[#1d9bf0]",
  tiktok: "border-l-[#8b5cf6]",
  youtube: "border-l-brand",
} as const;

/** Renders a Discord-style preview card under a message for each embeddable link in its body. */
export function MessageEmbeds({ body }: { body: string }) {
  const embeds = embedsForBody(body);

  if (embeds.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {embeds.map((embed) =>
        embed.type === "image" ? (
          <ImageEmbed key={embed.url} url={embed.url} />
        ) : (
          // The "board" behind link previews: sidebar-coloured surface, brand-coloured bar on the left.
          <div
            key={embed.url}
            className={`mt-1.5 w-full max-w-[520px] rounded-medium border border-divider border-l-[6px] ${ACCENT[embed.type === "linkCard" ? embed.provider : "youtube"]} bg-content1 px-4 py-5 dark:bg-surface-sidebar`}
          >
            {embed.type === "linkCard" ? (
              <LinkPreviewCard url={embed.url} />
            ) : (
              <YouTubeEmbed url={embed.url} videoId={embed.videoId} />
            )}
          </div>
        ),
      )}
    </div>
  );
}
