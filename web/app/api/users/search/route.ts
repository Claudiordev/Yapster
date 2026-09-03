import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";

export interface PlatformUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  roles: string[];
}

export const GET = withAuth(async (request, token) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (!query) return NextResponse.json([]);

  const page = searchParams.get("page") ?? "0";
  const size = searchParams.get("size") ?? "20";

  const users = await apiGet<PlatformUser[]>(
    `/users/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`,
    token,
  );

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      avatarUrl: toRelativeAvatar(u.avatarUrl),
      roles: Array.isArray(u.roles) ? u.roles : [],
    })),
  );
});
