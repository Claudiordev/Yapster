import { NextResponse } from "next/server";

import { apiDelete, apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { RouteContext } from "@/types/api";

type Ctx = RouteContext<{ folderId: string; gifId: string }>;

const path = (folderId: string, gifId: string) =>
  `/gif-library/folders/${encodeURIComponent(folderId)}/gifs/${encodeURIComponent(gifId)}`;

/** Saves a GIF into a folder (idempotent; the session service checks the links and limits). */
export const PUT = withAuth<Ctx>(async (request, token, { params }) => {
  const { folderId, gifId } = await params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (
    !body ||
    typeof body.previewUrl !== "string" ||
    typeof body.url !== "string"
  ) {
    return problemResponse(
      request,
      400,
      "Send the GIF's title, previewUrl and url",
    );
  }

  await apiPut(
    path(folderId, gifId),
    {
      title: typeof body.title === "string" ? body.title : "",
      previewUrl: body.previewUrl,
      url: body.url,
    },
    token,
  );

  return new NextResponse(null, { status: 204 });
});

/** Removes a GIF from a folder. */
export const DELETE = withAuth<Ctx>(async (_request, token, { params }) => {
  const { folderId, gifId } = await params;

  await apiDelete(path(folderId, gifId), token);

  return new NextResponse(null, { status: 204 });
});
