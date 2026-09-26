"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface YouTubeOEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

async function fetchOEmbed(url: string): Promise<YouTubeOEmbed> {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  );

  if (!res.ok) throw new Error("oembed failed");

  return res.json();
}

/**
 * YouTube link preview — thumbnail + title card that swaps to an inline
 * player on click, same "don't autoload the video" behavior Discord uses.
 * Metadata comes straight from YouTube's public oEmbed endpoint (CORS-open,
 * no backend proxy needed); a failed lookup just renders nothing.
 */
export function YouTubeEmbed({
  url,
  videoId,
}: {
  url: string;
  videoId: string;
}) {
  const [playing, setPlaying] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ["youtube-oembed", videoId],
    queryFn: () => fetchOEmbed(url),
    staleTime: Infinity,
    retry: 1,
  });

  if (isError) return null;

  if (playing) {
    return (
      <div className="w-full overflow-hidden rounded-medium bg-black aspect-video">
        <iframe
          allow="accelerate; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={data?.title ?? "YouTube video"}
        />
      </div>
    );
  }

  return (
    <button
      className="group block w-full overflow-hidden rounded-medium text-left"
      type="button"
      onClick={() => setPlaying(true)}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {data && (
          // eslint-disable-next-line @next/next/no-img-element -- external thumbnail, not a local/optimizable asset
          <img
            alt=""
            className="h-full w-full object-cover"
            src={data.thumbnail_url}
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger text-white shadow-large">
            <svg fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </div>

      {data && (
        <div className="px-1 pb-0.5 pt-2.5">
          <p className="truncate text-sm font-medium text-foreground">
            {data.title}
          </p>
          <p className="truncate text-tiny text-default-400">
            {data.author_name} · YouTube
          </p>
        </div>
      )}
    </button>
  );
}
