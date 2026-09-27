import { NextResponse } from "next/server";

import { apiPost } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

/** The signed-in user leaves a group (the creator can't — the chat service refuses and they delete it instead). */
export const POST = withAuth<RouteContext<{ conversationId: string }>>(
  async (_request, token, { params }) => {
    const { conversationId } = await params;

    await apiPost<Record<string, never>, void>(
      `/chat/${encodeURIComponent(conversationId)}/leave`,
      {},
      token,
    );

    return new NextResponse(null, { status: 204 });
  },
);
