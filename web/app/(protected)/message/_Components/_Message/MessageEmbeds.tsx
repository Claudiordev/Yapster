"use client";

import { embedsForBody } from "@/app/(protected)/message/_Components/_Message/utils/embeds";
import { ImageEmbed } from "./ImageEmbed";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { YouTubeEmbed } from "./YouTubeEmbed";

/** Renders a Discord-style preview card under a message for each embeddable link in its body. */
export function MessageEmbeds({ body }: { body: string }) {
  const embeds = embedsForBody(body);

  if (embeds.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {embeds.map((embed) =>
        embed.type === "image" ? (
          <ImageEmbed key={embed.url} url={embed.url} />
        ) : embed.type === "linkCard" ? (
          // Draws its own board: a link that is just a picture gets none.
          <LinkPreviewCard
            key={embed.url}
            provider={embed.provider}
            url={embed.url}
          />
        ) : (
          // The "board" behind a YouTube player: sidebar-coloured surface, brand-coloured bar on the left.
          <div
            key={embed.url}
            className="mt-1.5 w-full max-w-[520px] rounded-medium border border-divider border-l-[6px] border-l-brand bg-content1 px-4 py-5 empty:hidden dark:bg-surface-sidebar"
          >
            <YouTubeEmbed url={embed.url} videoId={embed.videoId} />
          </div>
        ),
      )}
    </div>
  );
}
