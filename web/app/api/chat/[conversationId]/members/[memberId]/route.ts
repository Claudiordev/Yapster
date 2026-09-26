import { NextResponse } from "next/server";

import { apiDelete } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

// Creator-only: remove a member from a group.
export const DELETE = withAuth<RouteContext<{ conversationId: string; memberId: string }>>(async (_request, token, { params }) => {
  const { conversationId, memberId } = await params;

  await apiDelete(`/chat/${conversationId}/members/${memberId}`, token);

  return new NextResponse(null, { status: 204 });
});
