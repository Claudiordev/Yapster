import { NextResponse } from "next/server";

import { apiPost } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

// Add a member to an existing group (rejected for DMs and once a group is full).
export const POST = withAuth<RouteContext<{ conversationId: string }>>(async (request, token, { params }) => {
  const { conversationId } = await params;
  const body = (await request.json()) as { memberId: string };

  await apiPost<{ memberId: string }, null>(
    `/chat/${conversationId}/members`,
    body,
    token,
  );

  return new NextResponse(null, { status: 204 });
});
