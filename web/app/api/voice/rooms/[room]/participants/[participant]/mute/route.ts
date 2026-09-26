import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/apiClient";
import { getAuthToken } from "@/lib/auth";
import { apiErrorResponse, problemResponse } from "@/lib/problemResponse";
import type { RouteContext } from "@/types/api";

export async function POST(
  request: Request,
  { params }: RouteContext<{ room: string; participant: string }>,
) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return problemResponse(request, 401, "Not authenticated", "Unauthorized");
    }

    const { room, participant } = await params;

    await apiPost<Record<string, never>, null>(
      `/voice/rooms/${encodeURIComponent(room)}/participants/${encodeURIComponent(participant)}/mute`,
      {},
      token,
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(request, error);
    }

    return problemResponse(request, 500, "Internal server error");
  }
}
