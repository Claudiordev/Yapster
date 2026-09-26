import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

/** Who is in the conversation's call right now (members only — the chat service enforces it). */
export const GET = withAuth<RouteContext<{ conversationId: string }>>(
  async (_request, token, { params }) => {
    const { conversationId } = await params;
    const userIds = await apiGet<string[]>(
      `/chat/${encodeURIComponent(conversationId)}/call-participants`,
      token,
    );

    return NextResponse.json(userIds, { headers: { "Cache-Control": "no-store" } });
  },
);
