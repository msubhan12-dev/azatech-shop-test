# ---- Stage 1: Build ----
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY apps/web/ ./apps/web/

# Build
WORKDIR /app/apps/web
RUN npm run build

# ---- Stage 2: Production ----
FROM node:24-alpine AS production

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -D -u 1001 -G appgroup appuser

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

# Copy built standalone app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

# Switch to non-root user
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
