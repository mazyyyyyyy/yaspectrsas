#!/bin/sh
# Подготовка БД и запуск API. Порядок важен:
#   1) migrate deploy — создаёт/обновляет таблицы;
#   2) rls.sql        — политики Row-Level Security (Prisma о них не знает,
#                       применяем сами после каждой миграции; идемпотентно);
#   3) seed           — стартовый справочник и админ. Идемпотентен: если
#                       компания уже есть, сам выходит, ничего не трогая.
set -eu

cd /app/apps/api

# libpq (psql/pg_isready) не понимает prisma-параметр «?schema=public» в URL —
# отрезаем query-строку. Схема public и так подхватывается по умолчанию.
PSQL_URL=$(printf '%s' "$DATABASE_URL" | sed 's/?.*$//')

echo "→ Жду PostgreSQL..."
until pg_isready -d "$PSQL_URL" >/dev/null 2>&1; do
  sleep 1
done
echo "✓ PostgreSQL готов"

echo "→ Применяю миграции..."
npx prisma migrate deploy --schema prisma/schema.prisma

echo "→ Применяю политики RLS..."
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -q -f prisma/rls.sql

echo "→ Проверяю стартовые данные (seed идемпотентен)..."
npx tsx prisma/seed.ts

echo "→ Запуск API"
exec "$@"
