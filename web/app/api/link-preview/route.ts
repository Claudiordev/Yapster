import { NextResponse } from "next/server";

import { verifyJwt } from "@/lib/auth";
import { withAuth } from "@/lib/bff";
import { gifBySlug, klipySlugFromUrl } from "@/lib/gifProvider";
import { linkPreview, providerOf } from "@/lib/linkPreview";
import { problemResponse } from "@/lib/problemResponse";
import { siteLinkPreview } from "@/lib/siteMetadata";

const SITE_PREVIEWS_PER_MINUTE = 30;
const siteLookups = new Map<string, { count: number; resetAt: number }>();

/** Generic previews make our server fetch arbitrary pages, so each user gets a small budget. */
function allowSiteLookup(key: string): boolean {
  const now = Date.now();
  const entry = siteLookups.get(key);

  if (!entry || entry.resetAt <= now) {
    if (siteLookups.size > 5000) siteLookups.clear();
    siteLookups.set(key, { count: 1, resetAt: now + 60_000 });

    return true;
  }

  entry.count += 1;

  return entry.count <= SITE_PREVIEWS_PER_MINUTE;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);

    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Preview card data for a link: TikTok / X posts through their oEmbed, anything else from its page's Open Graph tags. Signed-in users only. */
export const GET = withAuth(async (request, token) => {
  const url = new URL(request.url).searchParams.get("url") ?? "";

  if (url.length > 500 || !isHttpUrl(url)) {
    return problemResponse(request, 400, "Only http(s) links can be previewed");
  }

  let preview;
  const klipySlug = klipySlugFromUrl(url);

  if (providerOf(url)) {
    preview = await linkPreview(url);
  } else if (klipySlug) {
    // Klipy's pages block server fetches (Cloudflare), so look the GIF up through its API.
    const gif = await gifBySlug(klipySlug).catch(() => null);

    preview = gif
      ? {
          provider: "site" as const,
          url,
          author: "KLIPY",
          text: "",
          title: gif.title,
          imageUrl: gif.url,
          directImage: true,
        }
      : null;
  } else {
    const claims = await verifyJwt(token);

    if (!allowSiteLookup(claims?.sub ?? token.slice(-24))) {
      return problemResponse(request, 429, "Too many link previews, try again shortly");
    }

    preview = await siteLinkPreview(url);
  }

  if (!preview) return problemResponse(request, 404, "No preview available");

  return NextResponse.json(preview, {
    headers: { "Cache-Control": "private, max-age=600" },
  });
});
