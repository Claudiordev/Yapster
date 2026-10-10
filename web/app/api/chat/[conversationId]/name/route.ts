import { NextResponse } from "next/server";

import { apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

// Any member: rename a group. A blank name clears it (shown as its members).
export const PUT = withAuth<RouteContext<{ conversationId: string }>>(async (request, token, { params }) => {
  const { conversationId } = await params;
  const body = (await request.json()) as { name: string | null };

  await apiPut<{ name: string | null }, null>(
    `/chat/${conversationId}/name`,
    body,
    token,
  );

  return new NextResponse(null, { status: 204 });
});
