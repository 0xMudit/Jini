# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY server/ server/
COPY src/ src/
COPY index.html vite.config.ts ./
COPY .env.example .env

RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 jini && \
    adduser --system --uid 1001 jini

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/tsconfig.json /app/tsconfig.node.json ./

RUN mkdir -p /app/data && chown -R jini:jini /app/data

USER jini

EXPOSE 8788

ENV NODE_ENV=production
ENV PORT=8788

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8788/api/health || exit 1

CMD ["npx", "tsx", "server/index.ts"]
