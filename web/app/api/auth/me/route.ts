import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { toRelativeAvatar } from "@/lib/avatar";
import { rolesFromClaims, verifyJwt } from "@/lib/auth";
import { withAuth } from "@/lib/bff";
import type { SessionUser } from "@/types/user";

export const GET = withAuth(async (_request, token) => {
  // getAuthToken already validated the token. Roles come from the DB via /user
  // (the JWT claim is only a fallback) so a role change shows up immediately.
  const claims = await verifyJwt(token);
  const user = await apiGet<SessionUser>("/user", token);

  return NextResponse.json({
    id: user.id,
    username: user.username,
    balance: user.balance ?? null,
    avatarUrl: toRelativeAvatar(user.avatarUrl),
    roles: Array.isArray(user.roles) ? user.roles : rolesFromClaims(claims),
  });
});
