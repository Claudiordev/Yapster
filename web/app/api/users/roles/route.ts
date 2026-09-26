import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";

/** Every assignable role name (admin only — enforced by the backend). */
export const GET = withAuth(async (_request, token) => {
  const roles = await apiGet<string[]>("/users/roles", token);

  return NextResponse.json(roles, { headers: { "Cache-Control": "no-store" } });
});
