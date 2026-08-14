/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async rewrites() {
    const minio = process.env.MINIO_INTERNAL_URL || "http://localhost:9000";

    return [{ source: "/avatars/:path*", destination: `${minio}/avatars/:path*` }];
  },
};

module.exports = nextConfig;
