import { NextResponse } from "next/server";

import { apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";

/** Changes the current user's password (`PUT /user/password`). */
export const PUT = withAuth(async (request, token) => {
  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;

  if (
    !body ||
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return problemResponse(request, 400, "currentPassword and newPassword are required");
  }

  await apiPut<{ currentPassword: string; newPassword: string }, unknown>(
    "/user/password",
    { currentPassword: body.currentPassword, newPassword: body.newPassword },
    token,
  );

  return new NextResponse(null, { status: 204 });
});
