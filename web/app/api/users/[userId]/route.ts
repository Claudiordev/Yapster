import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";
import type { UserProfileData } from "@/types/user";
import type { RouteContext } from "@/types/api";

export const GET = withAuth<RouteContext<{ userId: string }>>(
  async (_request, token, { params }) => {
    const { userId } = await params;
    const user = await apiGet<UserProfileData>(
      `/users/${encodeURIComponent(userId)}`,
      token,
    );

    return NextResponse.json(
      {
        ...user,
        avatarUrl: toRelativeAvatar(user.avatarUrl),
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);
