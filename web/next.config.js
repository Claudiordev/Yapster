/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image
  // ships only the traced node_modules + a minimal server.js.
  output: "standalone",
  // Pin the file-tracing root to this app (avoids it guessing a parent dir).
  outputFileTracingRoot: __dirname,
  // Lint runs separately (`pnpm lint`); don't fail the production build on it.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
