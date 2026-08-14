import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { toRelativeAvatar } from "@/lib/avatar";
import { verifyJwt } from "@/lib/auth";
import { withAuth } from "@/lib/bff";

interface SessionUser {
  id: string;
  username: string;
  balance?: number;
  avatarUrl?: string | null;
}

export const GET = withAuth(async (_request, token) => {
  // getAuthToken already validated the token; decode it for the role claim.
  const claims = await verifyJwt(token);
  const user = await apiGet<SessionUser>("/user", token);

  return NextResponse.json({
    id: user.id,
    username: user.username,
    balance: user.balance ?? null,
    avatarUrl: toRelativeAvatar(user.avatarUrl),
    role: claims?.role ?? null,
  });
});
