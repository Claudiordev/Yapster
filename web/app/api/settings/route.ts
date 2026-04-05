import { NextResponse } from "next/server";

import { apiGet, apiPut, ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

interface TradingSettings {
  priceThreshold: number;
  timeThreshold: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export async function GET() {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const data = await apiGet<TradingSettings>("/trading/settings", token);

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

export async function PUT(request: Request) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const data = await apiPut<typeof body, TradingSettings>(
      "/trading/settings",
      body,
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
