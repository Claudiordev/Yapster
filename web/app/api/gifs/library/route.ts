import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { GifLibrary } from "@/types/gif";

/** The signed-in user's GIF folders, which folders hold each saved GIF, and their limits. */
export const GET = withAuth(async (_request, token) => {
  const library = await apiGet<GifLibrary>("/gif-library", token);

  return NextResponse.json(library, {
    headers: { "Cache-Control": "no-store" },
  });
});
