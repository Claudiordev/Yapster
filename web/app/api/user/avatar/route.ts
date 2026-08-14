import { NextResponse } from "next/server";

import { withAuth } from "@/lib/bff";
import { API_BASE_URL } from "@/lib/constants";

export const POST = withAuth(async (request, token) => {
  const formData = await request.formData();

  // Forward the multipart upload to the backend. Don't set Content-Type —
  // fetch derives the multipart boundary from the FormData body itself.
  const res = await fetch(`${API_BASE_URL}/user/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");

    return NextResponse.json(
      { error: text || "Upload failed" },
      { status: res.status },
    );
  }

  const text = await res.text();

  return text
    ? new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("content-type") ?? "application/json",
        },
      })
    : NextResponse.json({ success: true });
});
