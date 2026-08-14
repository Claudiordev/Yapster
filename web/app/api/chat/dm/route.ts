import { NextResponse } from "next/server";

import { apiPost } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";
import type { Conversation } from "@/lib/chat";

export const POST = withAuth(async (request, token) => {
  const body = (await request.json()) as { recipientUserId: string };
  const data = await apiPost<{ recipientUserId: string }, Conversation>(
    "/chat/dm",
    body,
    token,
  );

  return NextResponse.json(data, { status: 201 });
});
