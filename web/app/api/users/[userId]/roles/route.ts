import { NextResponse } from "next/server";

import { apiPut } from "@/lib/apiClient";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { UserProfileData } from "@/types/user";
import type { RouteContext } from "@/types/api";

/** Replaces a user's roles (admin only — enforced by the backend). */
export const PUT = withAuth<RouteContext<{ userId: string }>>(
  async (request, token, { params }) => {
    const { userId } = await params;
    const body = (await request.json().catch(() => null)) as {
      roles?: unknown;
    } | null;

    if (
      !body ||
      !Array.isArray(body.roles) ||
      !body.roles.every((role) => typeof role === "string")
    ) {
      return problemResponse(request, 400, "roles must be a list of role names");
    }

    const user = await apiPut<{ roles: string[] }, UserProfileData>(
      `/users/${encodeURIComponent(userId)}/roles`,
      { roles: body.roles as string[] },
      token,
    );

    return NextResponse.json({
      ...user,
      avatarUrl: toRelativeAvatar(user.avatarUrl),
    });
  },
);
