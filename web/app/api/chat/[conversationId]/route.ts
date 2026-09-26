import { NextResponse } from "next/server";

import { apiDelete } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

// Creator-only: delete a group entirely.
export const DELETE = withAuth<RouteContext<{ conversationId: string }>>(async (_request, token, { params }) => {
  const { conversationId } = await params;

  await apiDelete(`/chat/${conversationId}`, token);

  return new NextResponse(null, { status: 204 });
});
