import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { PlatformUser } from "@/types/user";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 50;

/** Batch lookup by id (`?ids=a,b,c`) — used to re-read the roles of a call's participants. */
export const GET = withAuth(async (request, token) => {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) return NextResponse.json([]);
  if (ids.length > MAX_IDS || !ids.every((id) => UUID.test(id))) {
    return problemResponse(request, 400, `ids must be up to ${MAX_IDS} user ids`);
  }

  const users = await apiGet<PlatformUser[]>(
    `/users?ids=${ids.map(encodeURIComponent).join(",")}`,
    token,
  );

  return NextResponse.json(
    users.map((user) => ({
      ...user,
      avatarUrl: toRelativeAvatar(user.avatarUrl),
      roles: Array.isArray(user.roles) ? user.roles : [],
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
});
