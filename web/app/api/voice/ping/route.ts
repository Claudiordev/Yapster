import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";

/** Latency probe: proxies the voice service's no-op ping so the client can time the full path. */
export const GET = withAuth(async (_request, token) => {
  const ping = await apiGet<{ serverTime: number }>("/voice/ping", token);

  return NextResponse.json(ping, { headers: { "Cache-Control": "no-store" } });
});
