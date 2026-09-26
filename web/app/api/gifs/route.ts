import { NextResponse } from "next/server";

import { withAuth } from "@/lib/bff";
import { GifProviderError, searchGifs, trendingGifs } from "@/lib/gifProvider";
import { problemResponse } from "@/lib/problemResponse";

const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 20;

/** Trending GIFs, or search results when `q` is given. Signed-in users only. */
export const GET = withAuth(async (request) => {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const page = Math.min(
    MAX_PAGE,
    Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
  );

  try {
    const result = query
      ? await searchGifs(query, page)
      : await trendingGifs(page);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GifProviderError) {
      return problemResponse(request, error.status, error.message);
    }
    throw error;
  }
});
