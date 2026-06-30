/**
 * A random UUID-ish id that also works over plain HTTP.
 *
 * `crypto.randomUUID()` only exists in a secure context (HTTPS or localhost),
 * so it's undefined when the app is served over http:// on a LAN IP. We fall
 * back to `crypto.getRandomValues` (available in insecure contexts) and, as a
 * last resort, a non-crypto id. These ids are only used as client-side
 * temporary keys, so cryptographic strength isn't required.
 */
export function randomId(): string {
  const c = globalThis.crypto;

  if (c?.randomUUID) return c.randomUUID();

  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));

    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));

    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}
