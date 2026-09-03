export function problemDetail(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof body.detail === "string" &&
    body.detail.trim()
  ) {
    return body.detail;
  }

  return fallback;
}

export async function readProblemDetail(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    return problemDetail(await response.json(), fallback);
  } catch {
    return fallback;
  }
}
