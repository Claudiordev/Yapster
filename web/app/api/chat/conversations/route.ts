import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { toRelativeAvatar } from "@/lib/avatar";
import { withAuth } from "@/lib/bff";
import type { Conversation, ConversationMember, UserStatus } from "@/lib/chat";
import type { PlatformUser } from "@/app/api/users/search/route";

/**
 * Raw shape from the chat service. It knows presence (who has an open socket)
 * but not identities, so members arrive as id + status and we resolve the
 * name/avatar half from the session service below.
 */
type ChatMember = { id: string; statusType: string };
type ChatSummary = Omit<Conversation, "members"> & { memberIds: ChatMember[] };
type RoomStatus = { ongoing: boolean; participantCount: number };

/**
 * Aggregation point: chat knows membership + presence, session knows identity.
 * We resolve every referenced member to a name/avatar in one batch call and
 * merge — so the browser gets ready-to-render `members` and never has to join
 * the two services itself.
 */
const KNOWN_STATUSES: UserStatus[] = ["online", "offline", "busy", "idle"];

function toStatus(raw: string | null | undefined): UserStatus {
  const value = raw?.toLowerCase();

  return KNOWN_STATUSES.includes(value as UserStatus)
    ? (value as UserStatus)
    : "offline";
}

export const GET = withAuth(async (_request, token) => {
  const summaries = await apiGet<ChatSummary[]>("/chat/conversations", token);

  const ids = Array.from(
    new Set(summaries.flatMap((s) => s.memberIds.map((m) => m.id))),
  );

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
      members: memberIds.map<ConversationMember>((member) => ({
        id: member.id,
        username: byId.get(member.id)?.username ?? null,
        avatarUrl: toRelativeAvatar(byId.get(member.id)?.avatarUrl),
        roles: byId.get(member.id)?.roles ?? [],
        // Java enum is UPPERCASE (ONLINE/BUSY/IDLE/OFFLINE); the UI union is
        // lowercase. Guard the mapping so an unknown value degrades to offline
        // rather than rendering an undefined CSS class.
        status: toStatus(member.statusType),
      })),
    }),
  );

  const statuses = await Promise.all(
    conversations.map(async (conversation) => {
      try {
        const status = await apiGet<RoomStatus>(
          `/voice/rooms/${encodeURIComponent(conversation.id)}/status`,
          token,
        );
        return [conversation.id, status] as const;
      } catch {
        return [conversation.id, null] as const;
      }
    }),
  );
  const statusByRoom = new Map(statuses);

  conversations.forEach((conversation) => {
    const status = statusByRoom.get(conversation.id);
    conversation.callOngoing = status?.ongoing ?? false;
    conversation.callParticipantCount = status?.participantCount ?? 0;
  });

  return NextResponse.json(conversations);
});
