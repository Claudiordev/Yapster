# syntax=docker/dockerfile:1

# ---- deps: install node_modules (native builds allowed via pnpm-workspace.yaml)
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat && npm install -g pnpm@11.1.3
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: static export (next.config.js has output: "export") -> /app/out
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11.1.3
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner: nginx serving the exported files, non-root on :8080
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 8080
