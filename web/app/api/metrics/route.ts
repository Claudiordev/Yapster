import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";

export const GET = withAuth(async (request, token) => {
  const type = new URL(request.url).searchParams.get("type");

  if (type !== "hits" && type !== "orders") {
    return NextResponse.json(
      { error: "Invalid type, must be 'hits' or 'orders'" },
      { status: 400 },
    );
  }

  const data = await apiGet(`/metrics/${type}`, token);

  return NextResponse.json(data);
});
