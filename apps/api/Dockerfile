# ---- Stage 1: Build ----
FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY apps/api/ ./apps/api/

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build
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
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Copy node_modules with prisma client
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

WORKDIR /app/apps/api

# Switch to non-root user
USER appuser

EXPOSE 3001

# Default command overridden in docker-compose
CMD ["node", "dist/main"]
