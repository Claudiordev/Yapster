import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { SavedGif } from "@/types/gif";
import type { RouteContext } from "@/types/api";

const MAX_QUERY_LENGTH = 100;

/** GIFs in one folder, newest first; `q` filters by title. */
export const GET = withAuth<RouteContext<{ folderId: string }>>(
  async (request, token, { params }) => {
    const { folderId } = await params;
    const query = (new URL(request.url).searchParams.get("q") ?? "")
      .trim()
      .slice(0, MAX_QUERY_LENGTH);
    const search = query ? `?${new URLSearchParams({ q: query })}` : "";
    const gifs = await apiGet<SavedGif[]>(
      `/gif-library/folders/${encodeURIComponent(folderId)}/gifs${search}`,
      token,
    );

    return NextResponse.json(gifs, {
      headers: { "Cache-Control": "no-store" },
    });
  },
);
