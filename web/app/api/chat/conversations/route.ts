import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";
import type { Conversation, ConversationMember } from "@/lib/chat";
import type { PlatformUser } from "@/app/api/users/search/route";

// Raw shape from the chat service — members are still bare UUIDs at this point.
type ChatSummary = Omit<Conversation, "members"> & { memberIds: string[] };

/**
 * Aggregation point: the chat service knows conversation membership (UUIDs)
 * but not identities. We resolve every referenced member to a name/avatar via
 * the session service in one batch call, then merge — so the browser gets
 * ready-to-render `members` and never has to join the two services itself.
 */
export const GET = withAuth(async (_request, token) => {
  const summaries = await apiGet<ChatSummary[]>("/chat/conversations", token);

  const ids = Array.from(new Set(summaries.flatMap((s) => s.memberIds)));

  let users: PlatformUser[] = [];

  if (ids.length > 0) {
    try {
      users = await apiGet<PlatformUser[]>(
        `/users?ids=${ids.map(encodeURIComponent).join(",")}`,
        token,
      );
    } catch {
      // session unreachable — degrade gracefully to unresolved members
    }
  }

  const byId = new Map(users.map((u) => [u.id, u]));

  const conversations: Conversation[] = summaries.map(
    ({ memberIds, ...rest }) => ({
      ...rest,
      members: memberIds.map<ConversationMember>((id) => ({
        id,
        username: byId.get(id)?.username ?? null,
        avatarUrl: toRelativeAvatar(byId.get(id)?.avatarUrl),
      })),
    }),
  );

  return NextResponse.json(conversations);
});

