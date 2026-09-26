/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow phones and other devices on this LAN to load development-only
  // Next assets from the dev server. This setting has no production effect.
  allowedDevOrigins: ["192.168.68.64"],
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // ships only the traced node_modules + a minimal server.js.
  output: "standalone",
  // Pin the file-tracing root to this app (avoids it guessing a parent dir).
  outputFileTracingRoot: __dirname,
  // Lint runs separately (`pnpm lint`); don't fail the production build on it.
  eslint: { ignoreDuringBuilds: true },
  // Serve avatars through this origin so every client (including LAN devices)
  // loads them from the app host, not the MinIO host baked into the stored URL.
  // The Next server proxies to MinIO, which it reaches internally.
  // The messages page sends no Referer, so X videos load straight from X's CDN (it answers 403
  // to requests carrying another site's Referer) and never pass through this server.
  // YouTube embeds need a Referer, so their iframe sets its own policy (YouTubeEmbed.tsx).
  async headers() {
    return [{ source: "/message/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
  async rewrites() {
    const minio = process.env.MINIO_INTERNAL_URL || "http://localhost:9000";

    return [{ source: "/avatars/:path*", destination: `${minio}/avatars/:path*` }];
  },
};

module.exports = nextConfig;
