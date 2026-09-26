import { readProblemDetail } from "@/lib/problemDetails";
import type { CallRegionsResponse } from "@/types/call";

export async function fetchCallRegions(
  room: string,
  signal?: AbortSignal,
): Promise<CallRegionsResponse> {
  const res = await fetch(`/api/voice/regions?room=${encodeURIComponent(room)}`, {
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw new Error(await readProblemDetail(res, "Could not load the servers."));
  }

  return (await res.json()) as CallRegionsResponse;
}

/**
 * Asks the voice service to move the whole call to `region`. On success the
 * backend pushes CALL_REGION_CHANGED to everyone in the call (including the
 * caller), and each client reconnects — see useCall's rejoinForServerChange.
 */
export async function changeCallRegion(
  room: string,
  region: string,
): Promise<void> {
  const res = await fetch(`/api/voice/rooms/${encodeURIComponent(room)}/region`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region }),
  });

  if (!res.ok) {
    throw new Error(await readProblemDetail(res, "Could not change the server."));
  }
}
