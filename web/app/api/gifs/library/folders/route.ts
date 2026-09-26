import { NextResponse } from "next/server";

import { apiPost } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { GifFolder } from "@/types/gif";

/** Creates a folder (Premium roles only; the session service enforces the limits). */
export const POST = withAuth(async (request, token) => {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;

  if (!body || typeof body.name !== "string") {
    return problemResponse(request, 400, "Send a folder name");
  }

  const folder = await apiPost<{ name: string }, GifFolder>(
    "/gif-library/folders",
    { name: body.name },
    token,
  );

  return NextResponse.json(folder, { status: 201 });
});
