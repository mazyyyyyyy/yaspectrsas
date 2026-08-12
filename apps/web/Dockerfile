# ─────────────────────────────────────────────────────────────
# Web (React + Vite PWA).  Контекст сборки — корень репозитория.
# Готовую статику отдаёт nginx, он же проксирует /api в контейнер API,
# поэтому фронт и бэкенд для браузера — один источник (cookie-сессия
# работает без послаблений в CORS).
# ─────────────────────────────────────────────────────────────

# ── Стадия сборки ────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# core собираем первым — web импортирует его собранный dist.
COPY packages/core ./packages/core
COPY apps/web ./apps/web
RUN npm run build --workspace @yaspectr/core \
 && npm run build --workspace @yaspectr/web

# ── Рантайм: nginx со статикой ───────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
