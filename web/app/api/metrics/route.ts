import { NextRequest, NextResponse } from "next/server";

import { apiGet, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const type = request.nextUrl.searchParams.get("type");

    if (type !== "hits" && type !== "orders") {
      return NextResponse.json(
        { error: "Invalid type, must be 'hits' or 'orders'" },
        { status: 400 },
      );
    }

    const data = await apiGet(`/metrics/${type}`, token);

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
