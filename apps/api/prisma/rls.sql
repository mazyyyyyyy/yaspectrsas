-- Row-Level Security — второй слой изоляции тенантов.
--
-- Первый слой — явный companyId в каждом запросе приложения. Этого достаточно
-- ровно до того дня, когда кто-то напишет findMany без where в спешке перед
-- релизом. RLS превращает такую ошибку из утечки чужих смет в пустой ответ.
--
-- КАК ПРИМЕНЯТЬ
--   psql "$DATABASE_URL" -f prisma/rls.sql
-- после каждого `prisma migrate deploy` (миграции Prisma не знают о политиках
-- и не пересоздают их).
--
-- ВАЖНО ПРО РОЛЬ ПОДКЛЮЧЕНИЯ
--   Политики не действуют на суперпользователя и на владельца таблиц, пока не
--   включён FORCE ROW LEVEL SECURITY (он здесь включён). Но приложение всё
--   равно должно ходить в БД отдельной ролью без BYPASSRLS и без прав
--   владельца — иначе защита существует только на бумаге:
--
--     CREATE ROLE yaspectr_app LOGIN PASSWORD '...';
--     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yaspectr_app;
--     GRANT USAGE ON SCHEMA public TO yaspectr_app;
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yaspectr_app;
--
--   Миграции гоняем владельцем, приложение работает под yaspectr_app.

-- Текущий тенант. Ставится в PrismaService.runAsTenant через set_config
-- с флагом is_local = true, поэтому живёт ровно до конца транзакции.
-- Третий аргумент current_setting = true: без установленного значения
-- возвращается NULL, а не ошибка.
CREATE OR REPLACE FUNCTION app_current_company() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid
$$;

-- ─────────────────────────────────────────────────────────────
-- Таблицы с прямым company_id
-- ─────────────────────────────────────────────────────────────

-- ВНИМАНИЕ: колонки создаёт Prisma, и он не переводит имена в snake_case.
-- В БД они называются "companyId", "estimateId" и так далее — в двойных
-- кавычках. Без кавычек Postgres свернёт имя в companyid и политика просто
-- не создастся.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'catalog_categories',
    'catalog_items',
    'kit_templates',
    'estimates',
    'work_acts',
    'telegram_chats',
    'document_counters',
    'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    -- Без установленного app.company_id не видно ничего: запрос в обход
    -- runAsTenant вернёт пустоту, а не чужие данные.
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING ("companyId" = app_current_company())
        WITH CHECK ("companyId" = app_current_company())
    $p$, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Дочерние таблицы — тенант через родителя
-- ─────────────────────────────────────────────────────────────
-- Своего company_id у них нет: дублировать его — значит однажды получить
-- строку сметы, принадлежащую другой компании, чем сама смета. Вместо этого
-- политика проверяет родителя. EXISTS по первичному ключу дёшев.

ALTER TABLE estimate_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_positions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON estimate_positions;
CREATE POLICY tenant_isolation ON estimate_positions
  USING (EXISTS (
    SELECT 1 FROM estimates e
    WHERE e.id = estimate_positions."estimateId" AND e."companyId" = app_current_company()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimates e
    WHERE e.id = estimate_positions."estimateId" AND e."companyId" = app_current_company()
  ));

ALTER TABLE estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON estimate_lines;
CREATE POLICY tenant_isolation ON estimate_lines
  USING (EXISTS (
    SELECT 1 FROM estimate_positions p
    JOIN estimates e ON e.id = p."estimateId"
    WHERE p.id = estimate_lines."positionId" AND e."companyId" = app_current_company()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM estimate_positions p
    JOIN estimates e ON e.id = p."estimateId"
    WHERE p.id = estimate_lines."positionId" AND e."companyId" = app_current_company()
  ));

ALTER TABLE kit_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON kit_lines;
CREATE POLICY tenant_isolation ON kit_lines
  USING (EXISTS (
    SELECT 1 FROM kit_templates k
    WHERE k.id = kit_lines."kitTemplateId" AND k."companyId" = app_current_company()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM kit_templates k
    WHERE k.id = kit_lines."kitTemplateId" AND k."companyId" = app_current_company()
  ));

ALTER TABLE work_act_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_act_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON work_act_items;
CREATE POLICY tenant_isolation ON work_act_items
  USING (EXISTS (
    SELECT 1 FROM work_acts a
    WHERE a.id = work_act_items."actId" AND a."companyId" = app_current_company()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM work_acts a
    WHERE a.id = work_act_items."actId" AND a."companyId" = app_current_company()
  ));

-- ─────────────────────────────────────────────────────────────
-- Исключения — и почему именно они
-- ─────────────────────────────────────────────────────────────
-- Под RLS сознательно НЕ ставятся companies, sessions и users. Причина у всех
-- трёх одна: они читаются на этапе аутентификации, когда тенант ещё неизвестен.
--
--   • companies — читается при регистрации, компании ещё нет;
--   • sessions  — ищется по хешу токена, прежде чем мы вообще узнали
--                 пользователя. Защита здесь в том, что найти строку можно,
--                 только зная сам токен;
--   • users     — ищется по email при входе и через сессию при каждом запросе.
--                 Под политикой company_id вход стал бы невозможен: тенант
--                 берётся ИЗ найденного пользователя, а не наоборот.
--
-- Отсюда следует обязанность прикладного слоя: любой запрос к users, кроме
-- поиска по email и по сессии, ОБЯЗАН явно фильтровать по companyId. Здесь
-- второго рубежа нет.
--
-- ─────────────────────────────────────────────────────────────
-- Обязательное условие работы
-- ─────────────────────────────────────────────────────────────
-- После применения этого файла ЛЮБОЙ запрос к таблицам выше обязан идти через
-- PrismaService.runAsTenant — только он выставляет app.company_id. Обычный
-- prisma.catalogItem.findMany() вернёт ноль строк, даже если данные есть.
-- Это не побочный эффект, а смысл конструкции: забытый тенант должен ломать
-- запрос сразу и громко, а не тихо отдавать чужое.
