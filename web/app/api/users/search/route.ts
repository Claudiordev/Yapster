import { NextResponse } from "next/server";

import { apiGet, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

export interface PlatformUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export async function GET(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";

  if (!query) return NextResponse.json([]);

  const page = searchParams.get("page") ?? "0";
  const size = searchParams.get("size") ?? "20";

  try {
    const users = await apiGet<PlatformUser[]>(
      `/users/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`,
      token,
    );

    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 },
    );
  }
}
