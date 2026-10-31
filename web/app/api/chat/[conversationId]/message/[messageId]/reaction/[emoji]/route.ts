import { NextResponse } from "next/server";

import { apiDelete, apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { RouteContext } from "@/types/api";

type ReactionContext = RouteContext<{
  conversationId: string;
  messageId: string;
  emoji: string;
}>;

const reactionPath = (conversationId: string, messageId: string, emoji: string) =>
  `/chat/${conversationId}/message/${messageId}/reaction/${encodeURIComponent(emoji)}`;

// React with an emoji (its unified hex key, e.g. 1f44d). Idempotent.
export const PUT = withAuth<ReactionContext>(async (_request, token, { params }) => {
  const { conversationId, messageId, emoji } = await params;

  await apiPut<undefined, void>(
    reactionPath(conversationId, messageId, emoji),
    undefined,
    token,
  );

  return new NextResponse(null, { status: 204 });
});

// Take your reaction back. Idempotent.
export const DELETE = withAuth<ReactionContext>(async (_request, token, { params }) => {
  const { conversationId, messageId, emoji } = await params;

  await apiDelete<void>(reactionPath(conversationId, messageId, emoji), token);

  return new NextResponse(null, { status: 204 });
});
