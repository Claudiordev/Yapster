import { NextResponse } from "next/server";

import { apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";

/** Saves the current user's bio (`PUT /user/bio`); blank clears it. */
export const PUT = withAuth(async (request, token) => {
  const body = (await request.json().catch(() => null)) as { bio?: unknown } | null;

  if (!body || (body.bio !== null && typeof body.bio !== "string")) {
    return problemResponse(request, 400, "bio must be text");
  }

  await apiPut<{ bio: string | null }, unknown>("/user/bio", { bio: body.bio ?? null }, token);

  return new NextResponse(null, { status: 204 });
});
