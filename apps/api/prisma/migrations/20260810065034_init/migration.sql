-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'INSTALLER');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('PCS', 'M', 'SET', 'HOUR');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('EQUIPMENT', 'MATERIAL', 'LABOR', 'CABLE');

-- CreateEnum
CREATE TYPE "QtyMode" AS ENUM ('PER_ROOT', 'FIXED');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EstimateMode" AS ENUM ('EXPRESS', 'DETAILED');

-- CreateEnum
CREATE TYPE "VatMode" AS ENUM ('NONE', 'ADDED', 'INCLUDED');

-- CreateEnum
CREATE TYPE "ActStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'SENT');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "inn" VARCHAR(12),
    "phone" VARCHAR(20),
    "address" VARCHAR(500),
    "logoPath" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "role" "Role" NOT NULL DEFAULT 'INSTALLER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "telegramUserId" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_categories" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "categoryId" UUID,
    "sku" VARCHAR(64),
    "name" VARCHAR(300) NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "unit" "Unit" NOT NULL,
    "materialPrice" INTEGER NOT NULL DEFAULT 0,
    "laborPrice" INTEGER NOT NULL DEFAULT 0,
    "costPrice" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_templates" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "rootItemId" UUID NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_lines" (
    "id" UUID NOT NULL,
    "kitTemplateId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "qtyMode" "QtyMode" NOT NULL DEFAULT 'PER_ROOT',
    "qtyPerRoot" INTEGER NOT NULL,
    "minPerRoot" INTEGER,
    "maxPerRoot" INTEGER,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kit_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "ownerId" UUID,
    "number" VARCHAR(32) NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "EstimateMode" NOT NULL DEFAULT 'EXPRESS',
    "title" VARCHAR(300) NOT NULL,
    "clientName" VARCHAR(300),
    "clientPhone" VARCHAR(20),
    "siteAddress" VARCHAR(500),
    "note" TEXT,
    "discountBp" INTEGER NOT NULL DEFAULT 0,
    "vatMode" "VatMode" NOT NULL DEFAULT 'NONE',
    "vatRateBp" INTEGER NOT NULL DEFAULT 2000,
    "totalMaterials" BIGINT NOT NULL DEFAULT 0,
    "totalLabor" BIGINT NOT NULL DEFAULT 0,
    "totalDiscount" BIGINT NOT NULL DEFAULT 0,
    "totalVat" BIGINT NOT NULL DEFAULT 0,
    "grandTotal" BIGINT NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_positions" (
    "id" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "catalogItemId" UUID,
    "kitTemplateId" UUID,
    "name" VARCHAR(300) NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "unit" "Unit" NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitMaterialPrice" INTEGER NOT NULL DEFAULT 0,
    "unitLaborPrice" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "catalogItemId" UUID,
    "kitLineId" UUID,
    "name" VARCHAR(300) NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "unit" "Unit" NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitMaterialPrice" INTEGER NOT NULL DEFAULT 0,
    "unitLaborPrice" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(1000),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_acts" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "estimateId" UUID,
    "number" VARCHAR(32) NOT NULL,
    "status" "ActStatus" NOT NULL DEFAULT 'OPEN',
    "siteAddress" VARCHAR(500) NOT NULL,
    "clientName" VARCHAR(300),
    "installerUserId" UUID,
    "installerName" VARCHAR(200) NOT NULL,
    "workDate" DATE NOT NULL,
    "sentToChatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_act_items" (
    "id" UUID NOT NULL,
    "actId" UUID NOT NULL,
    "estimateLineId" UUID,
    "name" VARCHAR(300) NOT NULL,
    "unit" "Unit" NOT NULL,
    "qtyPlanned" INTEGER NOT NULL DEFAULT 0,
    "qtyDone" INTEGER NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "checkedByUserId" UUID,
    "note" VARCHAR(1000),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_act_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_chats" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "chatId" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "companyId" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("companyId","kind","year")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorUserId" UUID,
    "entity" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "diff" JSONB,
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramUserId_key" ON "users"("telegramUserId");

-- CreateIndex
CREATE INDEX "users_companyId_isActive_idx" ON "users"("companyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "catalog_categories_companyId_sortOrder_idx" ON "catalog_categories"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_categories_companyId_name_key" ON "catalog_categories"("companyId", "name");

-- CreateIndex
CREATE INDEX "catalog_items_companyId_isActive_kind_idx" ON "catalog_items"("companyId", "isActive", "kind");

-- CreateIndex
CREATE INDEX "catalog_items_companyId_categoryId_idx" ON "catalog_items"("companyId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_companyId_sku_key" ON "catalog_items"("companyId", "sku");

-- CreateIndex
CREATE INDEX "kit_templates_companyId_isActive_idx" ON "kit_templates"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "kit_templates_companyId_rootItemId_idx" ON "kit_templates"("companyId", "rootItemId");

-- CreateIndex
CREATE INDEX "kit_lines_kitTemplateId_sortOrder_idx" ON "kit_lines"("kitTemplateId", "sortOrder");

-- CreateIndex
CREATE INDEX "estimates_companyId_status_updatedAt_idx" ON "estimates"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "estimates_companyId_ownerId_idx" ON "estimates"("companyId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_companyId_number_key" ON "estimates"("companyId", "number");

-- CreateIndex
CREATE INDEX "estimate_positions_estimateId_sortOrder_idx" ON "estimate_positions"("estimateId", "sortOrder");

-- CreateIndex
CREATE INDEX "estimate_lines_positionId_sortOrder_idx" ON "estimate_lines"("positionId", "sortOrder");

-- CreateIndex
CREATE INDEX "work_acts_companyId_status_workDate_idx" ON "work_acts"("companyId", "status", "workDate");

-- CreateIndex
CREATE INDEX "work_acts_companyId_installerUserId_idx" ON "work_acts"("companyId", "installerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "work_acts_companyId_number_key" ON "work_acts"("companyId", "number");

-- CreateIndex
CREATE INDEX "work_act_items_actId_sortOrder_idx" ON "work_act_items"("actId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_chats_companyId_chatId_key" ON "telegram_chats"("companyId", "chatId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_entity_entityId_idx" ON "audit_logs"("companyId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_templates" ADD CONSTRAINT "kit_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_templates" ADD CONSTRAINT "kit_templates_rootItemId_fkey" FOREIGN KEY ("rootItemId") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_lines" ADD CONSTRAINT "kit_lines_kitTemplateId_fkey" FOREIGN KEY ("kitTemplateId") REFERENCES "kit_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_lines" ADD CONSTRAINT "kit_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_positions" ADD CONSTRAINT "estimate_positions_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "estimate_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_acts" ADD CONSTRAINT "work_acts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_acts" ADD CONSTRAINT "work_acts_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_acts" ADD CONSTRAINT "work_acts_installerUserId_fkey" FOREIGN KEY ("installerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_act_items" ADD CONSTRAINT "work_act_items_actId_fkey" FOREIGN KEY ("actId") REFERENCES "work_acts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_act_items" ADD CONSTRAINT "work_act_items_estimateLineId_fkey" FOREIGN KEY ("estimateLineId") REFERENCES "estimate_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_counters" ADD CONSTRAINT "document_counters_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
