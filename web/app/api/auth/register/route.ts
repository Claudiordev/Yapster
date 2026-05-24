import { NextResponse } from "next/server";

import { apiPost, ApiError } from "@/lib/api-client";
import type {
  RegisterRequest,
  SessionRegisterResponse,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body: RegisterRequest = await request.json();

    const data = await apiPost<RegisterRequest, SessionRegisterResponse>(
      "/auth/register",
      body,
    );

    return NextResponse.json(data, { status: 201 });
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
