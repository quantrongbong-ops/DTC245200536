# ============================================================
# Backend Dockerfile - Multi-stage build
# ============================================================
FROM node:20-alpine AS base
LABEL maintainer="Restaurant Order Management"

WORKDIR /app

# Cài dependencies (chỉ production)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Production image
FROM base AS production
ENV NODE_ENV=production

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

# Copy dependencies
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules

# Copy source code
COPY --chown=nodeuser:nodejs src/ ./src/

USER nodeuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["node", "src/server.js"]
