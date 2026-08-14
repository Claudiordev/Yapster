import { NextResponse } from "next/server";

import { apiPost } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

type Ctx = { params: Promise<{ conversationId: string }> };

export const POST = withAuth<Ctx>(async (request, token, { params }) => {
  const { conversationId } = await params;
  const body = (await request.json()) as { seq: number };

  await apiPost<{ seq: number }, void>(
    `/chat/${conversationId}/read`,
    body,
    token,
  );

  return new NextResponse(null, { status: 204 });
});
