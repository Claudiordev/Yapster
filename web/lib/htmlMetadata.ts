/** What a page says about itself in its <head> (Open Graph / Twitter Card / <title>). */
export interface PageMetadata {
  title?: string;
  description?: string;
  siteName?: string;
  imageUrl?: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 400;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);

      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function clean(value: string | undefined, max: number): string | undefined {
  const text = decodeEntities(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  return text ? text.slice(0, max) : undefined;
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

  for (const match of Array.from(source.matchAll(re))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attributes;
}

/** An absolute http(s) URL for a (possibly relative) image reference, else undefined. */
function resolveImageUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(decodeEntities(value).trim(), base);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Reads the metadata out of (the start of) a page's HTML. `baseUrl` resolves relative image links. */
export function parseHtmlMetadata(html: string, baseUrl: string): PageMetadata {
  const meta = new Map<string, string>();

  for (const match of Array.from(html.matchAll(/<meta\s+([^>]*?)\/?>/gi))) {
    const attributes = parseAttributes(match[1]);
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();

    if (key && attributes.content !== undefined && !meta.has(key)) {
      meta.set(key, attributes.content);
    }
  }

  const pick = (...keys: string[]) =>
    keys.map((key) => meta.get(key)).find((value) => value?.trim());
  const pageTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];

  return {
    title: clean(pick("og:title", "twitter:title") ?? pageTitle, MAX_TITLE_LENGTH),
    description: clean(
      pick("og:description", "twitter:description", "description"),
      MAX_DESCRIPTION_LENGTH,
    ),
    siteName: clean(pick("og:site_name"), 80),
    imageUrl: resolveImageUrl(
      pick("og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"),
      baseUrl,
    ),
  };
}
