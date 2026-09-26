import { NextResponse } from "next/server";

import { apiDelete, apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { RouteContext } from "@/types/api";

type Ctx = RouteContext<{ folderId: string }>;

/** Renames a folder (not Favorites). */
export const PUT = withAuth<Ctx>(async (request, token, { params }) => {
  const { folderId } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;

  if (!body || typeof body.name !== "string") {
    return problemResponse(request, 400, "Send a folder name");
  }

  await apiPut(
    `/gif-library/folders/${encodeURIComponent(folderId)}`,
    { name: body.name },
    token,
  );

  return new NextResponse(null, { status: 204 });
});

/** Deletes a folder and the GIFs in it (not Favorites). */
export const DELETE = withAuth<Ctx>(async (_request, token, { params }) => {
  const { folderId } = await params;

  await apiDelete(
    `/gif-library/folders/${encodeURIComponent(folderId)}`,
    token,
  );

  return new NextResponse(null, { status: 204 });
});
