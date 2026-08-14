import { NextResponse } from "next/server";

import { withAuth } from "@/lib/bff";

/**
 * Returns the current bearer token for the browser to open the chat WebSocket
 * (`/ws?token=…`) — the HttpOnly cookie can't ride the WS upgrade.
 */
export const POST = withAuth(async (_request, token) =>
  NextResponse.json({ token }),
);
