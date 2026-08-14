import { NextResponse } from "next/server";

import { apiDelete } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

type Ctx = { params: Promise<{ conversationId: string; memberId: string }> };

// Creator-only: remove a member from a group.
export const DELETE = withAuth<Ctx>(async (_request, token, { params }) => {
  const { conversationId, memberId } = await params;

  await apiDelete(`/chat/${conversationId}/members/${memberId}`, token);

  return new NextResponse(null, { status: 204 });
});
