import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { withAuth } from "@/lib/bff";
import { API_BASE_URL } from "@/lib/constants";
import { problemDetail } from "@/lib/problem-details";
import { apiErrorResponse } from "@/lib/problem-response";

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
    let detail = res.statusText || "Upload failed";

    if (text) {
      try {
        detail = problemDetail(JSON.parse(text), detail);
      } catch {
        detail = text;
      }
    }

    return apiErrorResponse(
      request,
      new ApiError(
        res.status,
        detail,
        text,
        res.headers.get("content-type"),
        res.headers,
        res.statusText,
      ),
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
