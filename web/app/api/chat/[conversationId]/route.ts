import { NextResponse } from "next/server";

import { apiDelete } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

type Ctx = { params: Promise<{ conversationId: string }> };

// Creator-only: delete a group entirely.
export const DELETE = withAuth<Ctx>(async (_request, token, { params }) => {
  const { conversationId } = await params;

  await apiDelete(`/chat/${conversationId}`, token);

  return new NextResponse(null, { status: 204 });
});
