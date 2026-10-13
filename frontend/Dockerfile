# ============================================================
# Frontend Dockerfile - Multi-stage build
# Stage 1: build Vite -> dist
# Stage 2: nginx serve static + stub_status (cho exporter)
# ============================================================
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# ------------------------------------------------------------
# Stage 2: nginx phục vụ static
# ------------------------------------------------------------
FROM nginx:alpine
LABEL maintainer="Restaurant Order Management"

# Copy build output
COPY --from=build /app/dist /usr/share/nginx/html

# Copy cấu hình nginx (SPA fallback + stub_status + gzip)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
