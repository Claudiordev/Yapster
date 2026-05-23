import { NextResponse } from "next/server";

import { apiGet, ApiError } from "@/lib/api-client";
import { getAuthToken, verifyJwt } from "@/lib/auth";

interface SessionUser {
  id: string;
  username: string;
}

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const claims = await verifyJwt(token);

  if (!claims) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const user = await apiGet<SessionUser>("/user", token);

    return NextResponse.json({
      id: user.id,
      username: user.username,
      role: claims.role ?? null,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to load user" },
      { status: 500 },
    );
  }
}
