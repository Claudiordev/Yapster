# syntax=docker/dockerfile:1

# ---- deps: install node_modules (native builds allowed via pnpm-workspace.yaml)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat && npm install -g pnpm@11.1.3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the Next.js standalone server
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11.1.3
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner: minimal image that runs the standalone server
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# .env.production is read by the standalone server at startup (API_BASE_URL etc.)
COPY --from=builder /app/.env.production ./.env.production
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
# Binds 0.0.0.0:3000 (HOSTNAME), so publishing the port exposes it on the LAN IP.
CMD ["node", "server.js"]
