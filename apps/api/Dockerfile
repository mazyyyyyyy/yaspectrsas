# ─────────────────────────────────────────────────────────────
# API (NestJS + Fastify + Prisma).  Контекст сборки — корень репозитория,
# потому что это npm-workspaces монорепо и нужен package-lock + пакет core.
# ─────────────────────────────────────────────────────────────

# ── Стадия сборки ────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Сначала манифесты — так слой с npm ci кешируется, пока не менялись зависимости.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Исходники. core собираем первым — api импортирует его собранный dist.
COPY packages/core ./packages/core
COPY apps/api ./apps/api
RUN npm run build --workspace @yaspectr/core \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build --workspace @yaspectr/api

# ── Рантайм ──────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

# chromium — для генерации PDF (puppeteer-core), postgresql-client — миграции/RLS,
# шрифты — чтобы PDF с кириллицей не рисовался квадратами.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      postgresql-client \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

# node_modules целиком (с prisma CLI и tsx — нужны entrypoint'у для migrate/seed),
# собранный код и схема БД.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
