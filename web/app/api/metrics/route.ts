import { NextResponse } from "next/server";

import { apiGet } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problem-response";

export const GET = withAuth(async (request, token) => {
  const type = new URL(request.url).searchParams.get("type");

  if (type !== "hits" && type !== "orders") {
    return problemResponse(
      request,
      400,
      "Invalid type, must be 'hits' or 'orders'",
    );
  }

  const data = await apiGet(`/metrics/${type}`, token);

  return NextResponse.json(data);
});
