import { NextResponse } from "next/server";

import { apiPost } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { Conversation } from "@/types/chat";

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
