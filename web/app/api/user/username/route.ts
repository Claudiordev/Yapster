import { NextResponse } from "next/server";

import { apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";

/** Changes the current user's username (`PUT /user/username`); 409 when it is taken. */
export const PUT = withAuth(async (request, token) => {
  const body = (await request.json().catch(() => null)) as { newUsername?: unknown } | null;

  if (!body || typeof body.newUsername !== "string") {
    return problemResponse(request, 400, "newUsername is required");
  }

  await apiPut<{ newUsername: string }, unknown>(
    "/user/username",
    { newUsername: body.newUsername },
    token,
  );

  return new NextResponse(null, { status: 204 });
});
