import { NextResponse } from "next/server";

import { apiGet, apiPut } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

interface TradingSettings {
  priceThreshold: number;
  timeThreshold: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export const GET = withAuth(async (_request, token) => {
  const data = await apiGet<TradingSettings>("/trading/settings", token);

  return NextResponse.json(data);
});

export const PUT = withAuth(async (request, token) => {
  const body = await request.json();
  const data = await apiPut<typeof body, TradingSettings>(
    "/trading/settings",
    body,
    token,
  );

  return NextResponse.json(data);
});
