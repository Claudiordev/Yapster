import { ApiError } from "./api-client";

const FORWARDED_ERROR_HEADERS = [
  "retry-after",
  "www-authenticate",
  "x-ratelimit-remaining",
  "x-ratelimit-requested-tokens",
  "x-ratelimit-burst-capacity",
  "x-ratelimit-replenish-rate",
] as const;

function statusTitle(status: number, fallback?: string): string {
  if (fallback) return fallback;

  try {
    return new Response(null, { status }).statusText || "Request failed";
  } catch {
    return "Request failed";
  }
}

function forwardedHeaders(source?: Headers): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_ERROR_HEADERS) {
    const value = source?.get(name);

    if (value) headers.set(name, value);
  }

  return headers;
}

export function problemResponse(
  request: Request,
  status: number,
  detail: string,
  title?: string,
  headers = new Headers(),
): Response {
  headers.set("content-type", "application/problem+json");

  return new Response(
    JSON.stringify({
      type: "about:blank",
      title: statusTitle(status, title),
      status,
      detail,
      instance: new URL(request.url).pathname,
    }),
    { status, headers },
  );
}

/** Preserve an upstream RFC 7807 document, or create one for an empty/plain error. */
export function apiErrorResponse(request: Request, error: ApiError): Response {
  const headers = forwardedHeaders(error.responseHeaders);
  const isProblemDetails = error.contentType
    ?.toLowerCase()
    .includes("application/problem+json");

  if (isProblemDetails && error.responseBody.trim()) {
    headers.set("content-type", error.contentType!);

    return new Response(error.responseBody, { status: error.status, headers });
  }

  return problemResponse(
    request,
    error.status,
    error.message || statusTitle(error.status, error.statusText),
    statusTitle(error.status, error.statusText),
    headers,
  );
}
