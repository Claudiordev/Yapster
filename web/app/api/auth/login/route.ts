import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/apiClient";
import { setAuthCookies, toTokenPair } from "@/lib/auth";
import type { LoginRequest, SessionTokenResponse } from "@/types/auth";
import { apiErrorResponse, problemResponse } from "@/lib/problemResponse";

export async function POST(request: Request) {
  try {
    const body: LoginRequest = await request.json();

    const data = await apiPost<LoginRequest, SessionTokenResponse>(
      "/auth",
      body,
    );

    await setAuthCookies(toTokenPair(data));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return apiErrorResponse(request, error);
    }

    return problemResponse(request, 500, "Internal server error");
  }
}
