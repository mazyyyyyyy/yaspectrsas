import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export type DocumentKind = 'EST' | 'ACT';

const PREFIX: Record<DocumentKind, string> = {
  EST: 'СМ',
  ACT: 'АКТ',
};

/**
 * Номера документов.
 *
 * Счётчик — отдельная строка в БД, которую upsert блокирует на время
 * транзакции. Соблазнительная альтернатива COUNT(*) + 1 выдаёт двум
 * менеджерам, сохраняющим документ одновременно, один и тот же номер —
 * и это выясняется в момент, когда клиенту уже отправлены две «СМ-2026-0007».
 *
 * Нумерация сквозная в пределах компании и года: СМ-2026-0001, АКТ-2026-0001.
 */
@Injectable()
export class DocumentNumberService {
  async next(
    tx: Prisma.TransactionClient,
    companyId: string,
    kind: DocumentKind,
    now = new Date(),
  ): Promise<string> {
    const year = now.getFullYear();

    const counter = await tx.documentCounter.upsert({
      where: { companyId_kind_year: { companyId, kind, year } },
      create: { companyId, kind, year, value: 1 },
      update: { value: { increment: 1 } },
    });

    return `${PREFIX[kind]}-${year}-${String(counter.value).padStart(4, '0')}`;
  }
}
