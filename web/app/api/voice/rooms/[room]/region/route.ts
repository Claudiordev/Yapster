import { NextResponse } from "next/server";

import { apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { RouteContext } from "@/types/api";

/** Moves the whole call to another region (`PUT /voice/rooms/{room}/region`). */
export const PUT = withAuth<RouteContext<{ room: string }>>(
  async (request, token, { params }) => {
    const { room } = await params;
    const body = (await request.json().catch(() => null)) as {
      region?: unknown;
    } | null;

    if (!body || typeof body.region !== "string" || !body.region) {
      return problemResponse(request, 400, "region is required");
    }

    await apiPut<{ region: string }, unknown>(
      `/voice/rooms/${encodeURIComponent(room)}/region`,
      { region: body.region },
      token,
    );

    return new NextResponse(null, { status: 204 });
  },
);
