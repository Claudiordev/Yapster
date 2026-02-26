import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import { setAuthCookie } from "@/lib/auth";
import type { LoginRequest, LoginResponse } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body: LoginRequest = await request.json();

    const data = await apiPost<LoginRequest, LoginResponse>("/auth", body);

    await setAuthCookie(data.accessToken, Number(data.expiresInSeconds));

    return NextResponse.json({ success: true });
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
