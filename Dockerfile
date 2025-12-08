# =============================================================================
# Dord Roller - Multi-stage Docker Build
# =============================================================================
# This Dockerfile builds all clients and bundles them with the backend
# into a single production-ready image.
#
# Usage:
#   docker build -t dordroller .
#   docker run -p 3000:3000 --env-file .env dordroller
#
# Or with docker-compose:
#   docker-compose up -d
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build GM Client
# -----------------------------------------------------------------------------
FROM node:20-alpine AS gm-builder

WORKDIR /app/gm-client

# Copy package files first for better caching
COPY gm-client/package.json gm-client/pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY gm-client/ ./
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 2: Build Player Client
# -----------------------------------------------------------------------------
FROM node:20-alpine AS player-builder

WORKDIR /app/player-client

COPY player-client/package.json player-client/pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

COPY player-client/ ./
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Production Image
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy backend package files
COPY backend/package.json backend/pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy backend source
COPY backend/ ./

# Create public directory for static files
RUN mkdir -p public

# Copy built clients from builder stages
COPY --from=gm-builder /app/gm-client/dist ./public/gm
COPY --from=player-builder /app/player-client/dist ./public/player

# Copy static clients (no build step needed)
COPY obs-client/ ./public/obs
COPY landing/ ./public/landing

# Copy shared utilities
COPY shared/ ./shared

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the server
CMD ["node", "server.js"]
