import { NextResponse } from "next/server";

import { apiPost } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

export const POST = withAuth<RouteContext<{ conversationId: string }>>(async (request, token, { params }) => {
  const { conversationId } = await params;
  const body = (await request.json()) as { seq: number };

  await apiPost<{ seq: number }, void>(
    `/chat/${conversationId}/read`,
    body,
    token,
  );

  return new NextResponse(null, { status: 204 });
});
