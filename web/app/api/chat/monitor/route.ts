import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

export interface ServerInformation {
  onlineUsers: number;
  onlineDevices: number;
}

export const GET = withAuth(async (_request, token) => {
  const information = await apiGet<ServerInformation>("/chat/monitor", token);

  return NextResponse.json(information);
});
