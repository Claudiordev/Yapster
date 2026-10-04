import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { LinkedProvider } from "@/types/user";

/** The login providers (Google) linked to the current user. */
export const GET = withAuth(async (_request, token) => {
  const providers = await apiGet<LinkedProvider[]>("/user/providers", token);

  return NextResponse.json(providers ?? [], {
    headers: { "Cache-Control": "no-store" },
  });
});
