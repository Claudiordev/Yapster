import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api-client";
import { getAuthToken } from "@/lib/auth";

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

/**
 * Wraps a BFF route handler with the boilerplate every proxy route repeats:
 * resolve the auth token (401 if missing) and pass it to the handler, and
 * translate a backend `ApiError` into its status (else 500).
 *
 * Static routes ignore the third `ctx` arg; dynamic routes type it, e.g.
 * `withAuth<{ params: Promise<{ id: string }> }>(async (req, token, { params }) => …)`.
 */
export function withAuth<C = unknown>(
  handler: (request: Request, token: string, ctx: C) => Promise<Response> | Response,
) {
  return async (request: Request, ctx: C) => {
    const token = await getAuthToken();

    if (!token) return fail("Not authenticated", 401);

    try {
      return await handler(request, token, ctx);
    } catch (error) {
      return error instanceof ApiError
        ? fail(error.message, error.status)
        : fail("Something went wrong", 500);
    }
  };
}
