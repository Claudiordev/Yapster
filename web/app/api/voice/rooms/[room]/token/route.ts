import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";
import { apiErrorResponse, problemResponse } from "@/lib/problem-response";

interface RoomAccessResponse {
  serverUrl: string;
  token: string;
  room: string;
  identity: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ room: string }> },
) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return problemResponse(request, 401, "Not authenticated", "Unauthorized");
    }

    const { room } = await params;

    const data = await apiPost<Record<string, never>, RoomAccessResponse>(
      `/voice/rooms/${encodeURIComponent(room)}/token`,
      {},
      token,
    );

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(request, error);
    }

    return problemResponse(request, 500, "Internal server error");
  }
}
