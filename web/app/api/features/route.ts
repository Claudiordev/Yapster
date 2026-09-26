import { NextResponse } from "next/server";

import { apiGet, apiPost, apiPut } from "@/lib/apiClient";
import { withAuth } from "@/lib/bff";
import { problemResponse } from "@/lib/problemResponse";
import type { FeatureFlags } from "@/types/user";

/** Which features are on (any signed-in user). */
export const GET = withAuth(async (_request, token) => {
  const features = await apiGet<FeatureFlags>("/features", token);

  return NextResponse.json(features, { headers: { "Cache-Control": "no-store" } });
});

/** Adds a feature (admin only — enforced by the backend). */
export const POST = withAuth(async (request, token) => {
  const body = (await request.json().catch(() => null)) as { name?: unknown; enabled?: unknown } | null;

  if (!body || typeof body.name !== "string" || (body.enabled !== undefined && typeof body.enabled !== "boolean")) {
    return problemResponse(request, 400, "Send a feature name and optionally enabled: true or false");
  }

  const features = await apiPost<{ name: string; enabled?: boolean }, FeatureFlags>(
    "/features",
    { name: body.name, enabled: body.enabled as boolean | undefined },
    token,
  );

  return NextResponse.json(features, { status: 201 });
});

/** Switches features on or off (admin only — enforced by the backend). */
export const PUT = withAuth(async (request, token) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (
    !body ||
    Array.isArray(body) ||
    Object.keys(body).length === 0 ||
    !Object.values(body).every((value) => typeof value === "boolean")
  ) {
    return problemResponse(request, 400, "Send a map of feature name to true or false");
  }

  const features = await apiPut<FeatureFlags, FeatureFlags>("/features", body as FeatureFlags, token);

  return NextResponse.json(features);
});
