import { NextResponse } from "next/server";

import type { PlatformUser } from "@/types/user";
import { apiGet } from "@/lib/apiClient";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";

/** Paged directory of all users (admin only — enforced by the backend). */
export const GET = withAuth(async (request, token) => {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "0";
  const size = searchParams.get("size") ?? "20";

  const users = await apiGet<PlatformUser[]>(
    `/users/all?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`,
    token,
  );

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      avatarUrl: toRelativeAvatar(u.avatarUrl),
      roles: Array.isArray(u.roles) ? u.roles : [],
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
});
