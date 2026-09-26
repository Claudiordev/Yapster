import "server-only";

import type { Gif, GifPage } from "@/types/gif";

// KLIPY behind one small function pair, so another provider only touches this file.
const BASE_URL = "https://api.klipy.com/api/v1";
const PER_PAGE = 24;
// The test key allows 100 requests/hour in total, so everything is cached briefly.
const TRENDING_TTL_MS = 10 * 60_000;
const SEARCH_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 200;

interface KlipyFormat {
  url: string;
  width: number;
  height: number;
}

interface KlipyItem {
  id: number | string;
  title?: string;
  file?: Record<string, Record<string, KlipyFormat | undefined> | undefined>;
}

interface KlipyResponse {
  result: boolean;
  data?: { data?: KlipyItem[]; has_next?: boolean };
}

export class GifProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const cache = new Map<string, { expires: number; page: GifPage }>();

function toGif(item: KlipyItem): Gif | null {
  const preview = item.file?.sm?.webp ?? item.file?.sm?.gif;
  const full = item.file?.md?.webp ?? item.file?.md?.gif;

  if (!preview || !full) return null;

  return {
    id: String(item.id),
    title: item.title ?? "GIF",
    previewUrl: preview.url,
    url: full.url,
    width: full.width,
    height: full.height,
  };
}

async function fetchPage(
  path: string,
  params: Record<string, string>,
  ttl: number,
): Promise<GifPage> {
  const key = process.env.KLIPY_API_KEY;

  if (!key) throw new GifProviderError("GIF provider is not configured", 503);

  const search = new URLSearchParams({
    per_page: String(PER_PAGE),
    customer_id: "voxsi-web",
    ...params,
  });
  const cacheKey = `${path}?${search}`;
  const hit = cache.get(cacheKey);

  if (hit && hit.expires > Date.now()) return hit.page;

  const response = await fetch(
    `${BASE_URL}/${encodeURIComponent(key)}/gifs/${path}?${search}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);

  if (!response) throw new GifProviderError("GIF provider unreachable", 502);
  if (response.status === 429)
    throw new GifProviderError("GIF provider rate limit reached", 429);
  if (!response.ok) throw new GifProviderError("GIF provider error", 502);

  const body = (await response.json()) as KlipyResponse;
  const page: GifPage = {
    gifs: (body.data?.data ?? [])
      .map(toGif)
      .filter((gif): gif is Gif => gif !== null),
    hasNext: body.data?.has_next === true,
  };

  if (cache.size >= MAX_CACHE_ENTRIES)
    cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey, { expires: Date.now() + ttl, page });

  return page;
}

export function trendingGifs(page: number): Promise<GifPage> {
  return fetchPage("trending", { page: String(page) }, TRENDING_TTL_MS);
}

export function searchGifs(query: string, page: number): Promise<GifPage> {
  return fetchPage("search", { q: query, page: String(page) }, SEARCH_TTL_MS);
}
