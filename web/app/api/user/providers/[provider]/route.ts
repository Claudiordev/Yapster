import { NextResponse } from "next/server";

import { apiDelete } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

/** Unlinks a login provider from the current user (refused if it is their only way in). */
export const DELETE = withAuth<RouteContext<{ provider: string }>>(
  async (_request, token, { params }) => {
    const { provider } = await params;

    await apiDelete(`/user/providers/${encodeURIComponent(provider)}`, token);

    return new NextResponse(null, { status: 204 });
  },
);
