import { NextResponse } from "next/server";

import type { CallRegionsResponse } from "@/types/call";
import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";

/** Server list for a call, from the voice service (`GET /voice/regions?room=`). */
export const GET = withAuth(async (request, token) => {
  const room = new URL(request.url).searchParams.get("room");

  if (!room) return problemResponse(request, 400, "room is required");

  const data = await apiGet<CallRegionsResponse>(
    `/voice/regions?room=${encodeURIComponent(room)}`,
    token,
  );

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
});
