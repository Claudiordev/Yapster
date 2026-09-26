import "server-only";

import type { LinkPreview } from "@/types/linkPreview";

// Only fixed oEmbed endpoints are ever fetched (never the user's URL itself),
// so a message can't make the server request an arbitrary address.
const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);
const TWITTER_HOSTS = new Set([
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "x.com",
  "www.x.com",
  "mobile.x.com",
  // Embed-fixer mirrors people paste instead of the real link.
  "fxtwitter.com",
  "vxtwitter.com",
  "fixupx.com",
  "fixvx.com",
]);
const TWEET_PATH = /^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/;
const CACHE_TTL_MS = 60 * 60_000;
const MAX_CACHE_ENTRIES = 500;
const MAX_TEXT_LENGTH = 1000;
const MAX_PHOTOS = 4;

const cache = new Map<
  string,
  { expires: number; preview: LinkPreview | null }
>();

export function providerOf(raw: string): "tiktok" | "twitter" | null {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (TIKTOK_HOSTS.has(url.hostname)) return "tiktok";
  if (TWITTER_HOSTS.has(url.hostname) && TWEET_PATH.test(url.pathname))
    return "twitter";

  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** The tweet's text: the blockquote's first paragraph, without markup. */
function tweetText(html: string): string {
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? "";

  return decodeEntities(
    paragraph.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
  ).trim();
}

async function getJson(
  endpoint: string,
  url: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${endpoint}?${new URLSearchParams({ url })}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);

  return response?.ok
    ? ((await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null)
    : null;
}

const asText = (value: unknown) => (typeof value === "string" ? value : "");

// Media is only ever taken from X's own CDN, so the third-party API can't point readers elsewhere.
function twimgUrl(value: unknown): string | undefined {
  try {
    const url = new URL(asText(value));

    return url.protocol === "https:" && /(^|\.)twimg\.com$/.test(url.hostname)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

interface FxMedia {
  type?: string;
  url?: string;
  thumbnail_url?: string;
}

interface FxTweet {
  text?: string;
  author?: { name?: string; screen_name?: string };
  media?: { all?: FxMedia[] };
  quote?: FxTweet;
}

/** X's own oEmbed: text only, no media. Fallback when the media API is unavailable. */
async function oEmbedTweet(
  raw: string,
  path: string,
): Promise<LinkPreview | null> {
  const data = await getJson(
    "https://publish.x.com/oembed",
    `https://x.com${path}`,
  );

  if (!data) return null;

  return {
    provider: "twitter",
    url: raw,
    author: asText(data.author_name),
    text: tweetText(asText(data.html)).slice(0, MAX_TEXT_LENGTH),
  };
}

/** api.fxtwitter.com (open source) knows about videos and photos; the post's own media wins over a quoted post's. */
async function fxTwitterPreview(
  raw: string,
  path: string,
): Promise<LinkPreview | null> {
  const response = await fetch(`https://api.fxtwitter.com${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  const tweet = response?.ok
    ? ((await response.json().catch(() => null)) as { tweet?: FxTweet } | null)
        ?.tweet
    : undefined;

  if (!tweet) return null;

  // The post's own media wins over a quoted post's.
  const all = tweet.media?.all?.length
    ? tweet.media.all
    : (tweet.quote?.media?.all ?? []);
  const video = all.find(
    (item) => item.type === "video" || item.type === "gif",
  );
  const photoUrls = all
    .filter((item) => item.type === "photo")
    .map((item) => twimgUrl(item.url))
    .filter((url): url is string => url !== undefined)
    .slice(0, MAX_PHOTOS);
  const name = (post: FxTweet) =>
    post.author?.name ?? post.author?.screen_name ?? "";

  return {
    provider: "twitter",
    url: raw,
    author: name(tweet),
    text: asText(tweet.text).slice(0, MAX_TEXT_LENGTH),
    thumbnailUrl: twimgUrl(video?.thumbnail_url),
    videoUrl: twimgUrl(video?.url),
    photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    quote: tweet.quote
      ? {
          author: name(tweet.quote),
          text: asText(tweet.quote.text).slice(0, MAX_TEXT_LENGTH),
        }
      : undefined,
  };
}

/** Preview data for a TikTok or X/Twitter link, or null when it can't be read (private, deleted, …). */
export async function linkPreview(raw: string): Promise<LinkPreview | null> {
  const provider = providerOf(raw);

  if (!provider) return null;

  const hit = cache.get(raw);

  if (hit && hit.expires > Date.now()) return hit.preview;

  let preview: LinkPreview | null = null;

  if (provider === "tiktok") {
    const data = await getJson("https://www.tiktok.com/oembed", raw);

    if (data) {
      preview = {
        provider,
        url: raw,
        author: asText(data.author_name) || asText(data.author_unique_id),
        text: asText(data.title).slice(0, MAX_TEXT_LENGTH),
        thumbnailUrl: asText(data.thumbnail_url) || undefined,
      };
    }
  } else {
    // Mirror hosts (fxtwitter, vxtwitter, …) aren't oEmbed providers: use the original post's path.
    const path = new URL(raw).pathname;

    preview =
      (await fxTwitterPreview(raw, path)) ?? (await oEmbedTweet(raw, path));
  }

  if (cache.size >= MAX_CACHE_ENTRIES)
    cache.delete(cache.keys().next().value as string);
  cache.set(raw, { expires: Date.now() + CACHE_TTL_MS, preview });

  return preview;
}
