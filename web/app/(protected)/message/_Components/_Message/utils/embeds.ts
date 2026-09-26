// Discord-style "link unfurling": direct image/GIF URLs (render as-is), YouTube
// links (public, CORS-open oEmbed) and TikTok / X posts (card from our server route).
// Anything else is left as plain text.

// Same host rules the server's preview route enforces (lib/linkPreview.ts).
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

function providerOf(raw: string): "tiktok" | "twitter" | null {
  const url = new URL(raw);

  if (TIKTOK_HOSTS.has(url.hostname)) return "tiktok";
  if (TWITTER_HOSTS.has(url.hostname) && TWEET_PATH.test(url.pathname))
    return "twitter";

  return null;
}

const URL_RE = /https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]]/g;

const IMAGE_EXTENSIONS = /\.(gif|png|jpe?g|webp|avif)(\?.*)?$/i;

export type EmbedKind =
  | { type: "image"; url: string }
  | { type: "youtube"; url: string; videoId: string }
  | { type: "linkCard"; url: string; provider: "tiktok" | "twitter" };

/** All URLs found in a message body, in order, de-duplicated. */
export function extractUrls(body: string): string[] {
  return Array.from(new Set(body.match(URL_RE) ?? []));
}

function youTubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null;
  }

  if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    if (url.pathname.startsWith("/shorts/"))
      return url.pathname.split("/")[2] ?? null;
    if (url.pathname.startsWith("/embed/"))
      return url.pathname.split("/")[2] ?? null;
  }

  return null;
}

/** Classifies a single URL for embedding, or null if it's not embeddable. */
export function classifyEmbedUrl(raw: string): EmbedKind | null {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const videoId = youTubeVideoId(url);

  if (videoId) return { type: "youtube", url: raw, videoId };
  if (IMAGE_EXTENSIONS.test(url.pathname)) return { type: "image", url: raw };
  const provider = providerOf(raw);

  if (provider) return { type: "linkCard", url: raw, provider };

  return null;
}

/** Embeddable links in a message body, capped so one message can't flood the thread. */
const MAX_EMBEDS_PER_MESSAGE = 3;

export function embedsForBody(body: string): EmbedKind[] {
  return extractUrls(body)
    .map(classifyEmbedUrl)
    .filter((e): e is EmbedKind => e !== null)
    .slice(0, MAX_EMBEDS_PER_MESSAGE);
}

/** True when the whole message is one image/GIF link (e.g. a picked GIF): the link text is then hidden. */
export function isImageOnlyBody(body: string): boolean {
  const trimmed = body.trim();

  return !/\s/.test(trimmed) && classifyEmbedUrl(trimmed)?.type === "image";
}

export type BodyPart = { text: string; href?: string };

/** Splits a message body so YouTube / TikTok / X links can be rendered as clickable anchors. */
export function linkifyBody(body: string): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;

  for (const match of Array.from(body.matchAll(URL_RE))) {
    const kind = classifyEmbedUrl(match[0])?.type;

    if (kind !== "youtube" && kind !== "linkCard") continue;

    if (match.index > last) parts.push({ text: body.slice(last, match.index) });
    parts.push({ text: match[0], href: match[0] });
    last = match.index + match[0].length;
  }

  if (last < body.length) parts.push({ text: body.slice(last) });

  return parts;
}
