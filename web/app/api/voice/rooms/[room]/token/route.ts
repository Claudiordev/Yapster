import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

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
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
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
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
