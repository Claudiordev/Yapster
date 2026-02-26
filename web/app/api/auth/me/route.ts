import { NextResponse } from "next/server";

import { getAuthToken, decodeJwtPayload } from "@/lib/auth";

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = decodeJwtPayload(token);

  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  return NextResponse.json({
    username: payload.sub,
    role: payload.role,
  });
}
