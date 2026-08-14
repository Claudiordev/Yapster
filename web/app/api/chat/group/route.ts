import { NextResponse } from "next/server";

import { apiPost } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";
import type { Conversation } from "@/lib/chat";

interface CreateGroupBody {
  groupName: string;
  memberIds: string[];
}

export const POST = withAuth(async (request, token) => {
  const body = (await request.json()) as CreateGroupBody;
  const data = await apiPost<CreateGroupBody, Conversation>(
    "/chat/group",
    body,
    token,
  );

  return NextResponse.json(data, { status: 201 });
});
