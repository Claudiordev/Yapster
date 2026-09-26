import { NextResponse } from "next/server";

import { withAuth } from "@/lib/bff";
import { linkPreview, providerOf } from "@/lib/linkPreview";
import { problemResponse } from "@/lib/problemResponse";

/** Preview card data for a TikTok or X/Twitter link. Signed-in users only. */
export const GET = withAuth(async (request) => {
  const url = new URL(request.url).searchParams.get("url") ?? "";

  if (url.length > 500 || !providerOf(url)) {
    return problemResponse(
      request,
      400,
      "Only TikTok and X/Twitter links can be previewed",
    );
  }

  const preview = await linkPreview(url);

  if (!preview) return problemResponse(request, 404, "No preview available");

  return NextResponse.json(preview, {
    headers: { "Cache-Control": "private, max-age=600" },
  });
});
