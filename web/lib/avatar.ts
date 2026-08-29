/**
 * Normalizes a stored avatar URL to a **same-origin** path so it loads from
 * whatever host the browser used for the app — not the MinIO host baked in at
 * upload time (which is only reachable from the dev machine).
 *
 * The stored value looks like `http://localhost:9000/avatars/<key>`; we keep
 * just the path (`/avatars/<key>`), which a Next rewrite proxies to MinIO
 * server-side (see next.config.js). Avatars only ever come from our own MinIO,
 * so stripping the host is safe.
 */
export function toRelativeAvatar(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  try {
    return new URL(url).pathname; // absolute → /avatars/<key>
  } catch {
    return url; // already a relative path
  }
}
