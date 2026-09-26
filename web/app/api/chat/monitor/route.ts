import { NextResponse } from "next/server";

import { apiGet } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import type { ServerInformation } from "@/types/api";

export const GET = withAuth(async (_request, token) => {
  const information = await apiGet<ServerInformation>("/chat/monitor", token);

  return NextResponse.json(information);
});
