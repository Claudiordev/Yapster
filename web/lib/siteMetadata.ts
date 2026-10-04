import "server-only";

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";

import { parseHtmlMetadata } from "@/lib/htmlMetadata";
import { isPublicAddress } from "@/lib/publicAddress";
import type { LinkPreview } from "@/types/linkPreview";

/**
 * Preview cards for any website: we fetch the page ourselves and read its Open Graph /
 * Twitter Card tags. The URL comes straight from a chat message, so every request is
 * locked down: public addresses only (checked on the address the socket really connects
 * to, and again on each redirect), default ports, a few redirects, a short timeout and a
 * size cap, no cookies.
 */
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 512 * 1024;
const IDLE_TIMEOUT_MS = 5000;
const DEADLINE_MS = 8000;
const CACHE_TTL_MS = 60 * 60_000;
const FAILURE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, { expires: number; preview: LinkPreview | null }>();

class UnsafeUrlError extends Error {}

function assertFetchable(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) links can be previewed");
  }
  if (url.username || url.password) throw new UnsafeUrlError("Links with credentials");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UnsafeUrlError("Non-standard port");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(host) && !isPublicAddress(host)) {
    throw new UnsafeUrlError("Non-public address");
  }
}

/** Resolves like the default, but refuses to connect if ANY answer is not a public address. */
const safeLookup = ((hostname: string, options: dns.LookupOptions, callback: (...args: unknown[]) => void) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);

    const list = addresses as dns.LookupAddress[];

    if (list.length === 0 || !list.every((entry) => isPublicAddress(entry.address))) {
      return callback(new UnsafeUrlError("Non-public address"));
    }

    return options.all ? callback(null, list) : callback(null, list[0].address, list[0].family);
  });
}) as unknown as net.LookupFunction;

type Hop =
  | { kind: "redirect"; location: string }
  | { kind: "image"; url: URL }
  | { kind: "html"; url: URL; html: string }
  | { kind: "none" };

/** The start of the page, up to </head> or the size cap, whichever comes first. */
function readHead(res: http.IncomingMessage, contentType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
    let stream: Readable = res;

    if (encoding === "gzip") stream = res.pipe(zlib.createGunzip());
    else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
    else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
    else if (encoding && encoding !== "identity") {
      res.destroy();

      return resolve("");
    }

    let decoder: TextDecoder;

    try {
      decoder = new TextDecoder(/charset=([\w-]+)/.exec(contentType)?.[1] ?? "utf-8");
    } catch {
      decoder = new TextDecoder("utf-8");
    }

    let html = "";
    let bytes = 0;
    let done = false;
    const finish = () => {
      if (done) return;

      done = true;
      res.destroy();
      stream.destroy();
      resolve(html);
    };

    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      html += decoder.decode(chunk, { stream: true });

      if (bytes >= MAX_HTML_BYTES || /<\/head>/i.test(html)) finish();
    });
    stream.on("end", finish);
    stream.on("error", (error) => {
      if (done) return;

      done = true;
      reject(error);
    });
  });
}

function requestOnce(url: URL): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    let settled = false;
    const settle = (action: () => void) => {
      if (settled) return;

      settled = true;
      clearTimeout(deadline);
      action();
    };
    const req = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: IDLE_TIMEOUT_MS,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
          Accept: "text/html,application/xhtml+xml,image/*;q=0.8",
          "Accept-Language": "en",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();

          return settle(() => resolve({ kind: "redirect", location: String(res.headers.location) }));
        }

        const contentType = String(res.headers["content-type"] ?? "").toLowerCase();

        if (status < 200 || status >= 300) {
          res.destroy();

          return settle(() => resolve({ kind: "none" }));
        }
        if (contentType.startsWith("image/")) {
          res.destroy();

          return settle(() => resolve({ kind: "image", url }));
        }
        if (!/^(text\/html|application\/xhtml\+xml)/.test(contentType)) {
          res.destroy();

          return settle(() => resolve({ kind: "none" }));
        }

        readHead(res, contentType).then(
          (html) => settle(() => resolve({ kind: "html", url, html })),
          (error) => settle(() => reject(error)),
        );
      },
    );
    const deadline = setTimeout(() => req.destroy(new Error("deadline")), DEADLINE_MS);

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (error) => settle(() => reject(error)));
    req.end();
  });
}

async function fetchPage(start: URL): Promise<Hop> {
  let url = start;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    assertFetchable(url);

    const hop = await requestOnce(url);

    if (hop.kind !== "redirect") return hop;

    url = new URL(hop.location, url);
  }

  return { kind: "none" };
}

/**
 * The browser loads og:image itself, so an image on a private address would make every
 * viewer's browser request it. Names can't be checked here, but literal private IPs and
 * obvious internal names are dropped.
 */
function isPublicImageUrl(value: string | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
      return false;
    }

    return !(net.isIP(host) && !isPublicAddress(host));
  } catch {
    return false;
  }
}

const hostLabel = (url: URL) => url.hostname.replace(/^www\./, "");

/** Preview data for any http(s) page or image link, or null when there's nothing to show. */
export async function siteLinkPreview(raw: string): Promise<LinkPreview | null> {
  const hit = cache.get(raw);

  if (hit && hit.expires > Date.now()) return hit.preview;

  let preview: LinkPreview | null = null;

  try {
    const hop = await fetchPage(new URL(raw));

    if (hop.kind === "image") {
      preview = {
        provider: "site",
        url: raw,
        author: hostLabel(hop.url),
        text: "",
        imageUrl: hop.url.toString(),
        directImage: true,
      };
    } else if (hop.kind === "html") {
      const meta = parseHtmlMetadata(hop.html, hop.url.toString());
      const imageUrl = isPublicImageUrl(meta.imageUrl) ? meta.imageUrl : undefined;

      if (meta.title || meta.description || imageUrl) {
        preview = {
          provider: "site",
          url: raw,
          author: meta.siteName ?? hostLabel(hop.url),
          text: meta.description ?? "",
          title: meta.title,
          imageUrl,
        };
      }
    }
  } catch {
    preview = null;
  }

  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(raw, {
    expires: Date.now() + (preview ? CACHE_TTL_MS : FAILURE_TTL_MS),
    preview,
  });

  return preview;
}
