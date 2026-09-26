/** Stable library id for a GIF known only by its link (chat messages carry no provider id). */
export function gifIdFromUrl(url: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;

  for (let i = 0; i < url.length; i++) {
    a = Math.imul(a ^ url.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b + url.charCodeAt(i), 0x85ebca6b) >>> 0;
  }

  return `url-${a.toString(16)}${b.toString(16)}`;
}
