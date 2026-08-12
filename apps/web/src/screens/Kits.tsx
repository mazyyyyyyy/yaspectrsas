import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ITEM_KIND_LABELS,
  UNIT_LABELS,
  formatMoney,
  formatQty,
  parseQty,
} from '@yaspectr/core';
import {
  useArchiveKit,
  useCatalog,
  useKits,
  useSaveKit,
  type KitLinePayload,
} from '../api/hooks.js';
import type { CatalogItem, KitTemplate } from '../api/types.js';
import { useAuth } from '../auth.js';
import { Modal } from '../modal.js';
import { Empty, ErrorBox, Field, IconPlus, IconTrash, Spinner, TextInput, iconForItem } from '../ui.js';

/**
 * Шаблоны комплектов — то самое «если монтаж камеры, то сразу юстировка
 * + распред. коробка». Экран показывает, что развернётся при добавлении
 * базовой позиции в смету, и позволяет эти комплекты создавать и править.
 */

/** PER_ROOT — на каждую базовую позицию, FIXED — один раз на объект. */
const QTY_MODE_LABEL: Record<'PER_ROOT' | 'FIXED', string> = {
  PER_ROOT: 'на позицию',
  FIXED: 'на объект',
};

export function KitsScreen() {
  const { data, isLoading, error } = useKits();
  const [editing, setEditing] = useState<KitTemplate | 'new' | null>(null);
  const { can } = useAuth();
  const canEdit = can('kit:write');

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">Шаблоны комплектов</h1>
          <div className="page-sub">
            Добавляя базовую позицию в смету, вы получаете весь комплект целиком.
          </div>
        </div>
        {canEdit && (
          <button type="button" className="btn-outline" onClick={() => setEditing('new')}>
            <IconPlus />
            Создать комплект
          </button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <ErrorBox error={error} />
        {isLoading && <Spinner label="Загрузка комплектов…" />}

        {data && data.length === 0 && (
          <Empty
            title="Комплектов пока нет"
            hint={canEdit ? 'Нажмите «Создать комплект», чтобы добавить первый.' : undefined}
          />
        )}

        {data?.map((kit) => (
          <div key={kit.id} className={`position${kit.isActive ? '' : ' line-off'}`}>
            <div className="position-head">
              <div className="position-icon">{iconForItem(kit.rootItem.name, kit.rootItem.kind)}</div>
              <div className="grow">
                <div className="position-name">{kit.name}</div>
                <div className="position-sub">Базовая позиция: {kit.rootItem.name}</div>
              </div>
              {kit.isDefault && <span className="badge">по умолчанию</span>}
              {canEdit && (
                <button
                  type="button"
                  className="muted"
                  style={{ fontSize: 13, marginLeft: 12 }}
                  onClick={() => setEditing(kit)}
                >
                  Изменить
                </button>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Что добавляется</th>
                    <th>Тип</th>
                    <th className="right">Норма</th>
                    <th className="right">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {kit.lines.map((kitLine) => (
                    <tr key={kitLine.id}>
                      <td>
                        {kitLine.item.name}
                        {kitLine.isOptional && <span className="faint"> · необязательно</span>}
                      </td>
                      <td className="muted">{ITEM_KIND_LABELS[kitLine.item.kind]}</td>
                      <td className="right">
                        {formatQty(kitLine.qtyPerRoot, UNIT_LABELS[kitLine.item.unit])}
                        <span className="faint"> {QTY_MODE_LABEL[kitLine.qtyMode]}</span>
                        {kitLine.minPerRoot !== null && kitLine.maxPerRoot !== null && (
                          <div className="faint" style={{ fontSize: 11 }}>
                            типовой диапазон {formatQty(kitLine.minPerRoot)}–
                            {formatQty(kitLine.maxPerRoot)}
                          </div>
                        )}
                      </td>
                      <td className="right">
                        {kitLine.item.materialPrice > 0 && formatMoney(kitLine.item.materialPrice)}
                        {kitLine.item.materialPrice > 0 && kitLine.item.laborPrice > 0 && ' + '}
                        {kitLine.item.laborPrice > 0 && (
                          <span className="muted">{formatMoney(kitLine.item.laborPrice)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {kit.lines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="faint">
                        В комплекте пока нет позиций.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <KitModal kit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Форма комплекта
// ─────────────────────────────────────────────────────────────

interface LineForm {
  uid: number;
  itemId: string;
  qtyMode: 'PER_ROOT' | 'FIXED';
  qty: string;
  isOptional: boolean;
  min: string;
  max: string;
}

function KitModal({ kit, onClose }: { kit: KitTemplate | null; onClose: () => void }) {
  const save = useSaveKit();
  const archive = useArchiveKit();
  const catalog = useCatalog();
  const items = catalog.data?.items ?? [];
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const uidRef = useRef(0);
  const nextUid = () => ++uidRef.current;

  const [name, setName] = useState(kit?.name ?? '');
  const [rootItemId, setRootItemId] = useState(kit?.rootItemId ?? '');
  const [isDefault, setIsDefault] = useState(kit?.isDefault ?? false);
  const [lines, setLines] = useState<LineForm[]>(
    () =>
      kit?.lines.map((line) => ({
        uid: nextUid(),
        itemId: line.itemId,
        qtyMode: line.qtyMode,
        qty: formatQty(line.qtyPerRoot),
        isOptional: line.isOptional,
        min: line.minPerRoot !== null ? formatQty(line.minPerRoot) : '',
        max: line.maxPerRoot !== null ? formatQty(line.maxPerRoot) : '',
      })) ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const updateLine = (uid: number, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        uid: nextUid(),
        itemId: items[0]?.id ?? '',
        qtyMode: 'PER_ROOT',
        qty: '1',
        isOptional: false,
        min: '',
        max: '',
      },
    ]);

  const removeLine = (uid: number) => setLines((prev) => prev.filter((l) => l.uid !== uid));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (!rootItemId) {
      setLocalError('Выберите базовую позицию комплекта.');
      return;
    }

    const payloadLines: KitLinePayload[] = [];
    for (const [index, line] of lines.entries()) {
      if (!line.itemId) {
        setLocalError(`Строка ${index + 1}: выберите позицию.`);
        return;
      }
      const qty = parseQty(line.qty);
      if (qty === null || qty <= 0) {
        setLocalError(`Строка ${index + 1}: укажите количество больше нуля.`);
        return;
      }
      const min = line.min.trim() ? parseQty(line.min) : null;
      const max = line.max.trim() ? parseQty(line.max) : null;
      if ((line.min.trim() && min === null) || (line.max.trim() && max === null)) {
        setLocalError(`Строка ${index + 1}: некорректный диапазон.`);
        return;
      }
      payloadLines.push({
        itemId: line.itemId,
        qtyMode: line.qtyMode,
        qtyPerRoot: qty,
        minPerRoot: min,
        maxPerRoot: max,
        isOptional: line.isOptional,
        sortOrder: index,
      });
    }

    await save.mutateAsync({
      id: kit?.id,
      name: name.trim(),
      rootItemId,
      isDefault,
      lines: payloadLines,
    });
    onClose();
  }

  return (
    <Modal title={kit ? 'Шаблон комплекта' : 'Новый комплект'} onClose={onClose} width={720}>
      {catalog.isLoading ? (
        <Spinner label="Загрузка справочника…" />
      ) : (
        <form className="stack" onSubmit={submit}>
          <Field label="Название комплекта">
            <TextInput
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Камера под ключ"
            />
          </Field>

          <Field label="Базовая позиция">
            <select
              className="input"
              value={rootItemId}
              onChange={(e) => setRootItemId(e.target.value)}
              required
            >
              <option value="">— выберите позицию —</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
              Комплект развернётся, когда эту позицию добавят в смету.
            </div>
          </Field>

          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            <span>Подставлять этот комплект по умолчанию</span>
          </label>

          <div className="row" style={{ marginTop: 6 }}>
            <div className="grow" style={{ fontWeight: 600 }}>
              Что входит в комплект
            </div>
            <button type="button" className="head-chip" onClick={addLine}>
              <IconPlus />
              Добавить строку
            </button>
          </div>

          {lines.length === 0 && (
            <div className="faint">Пока пусто. Нажмите «Добавить строку».</div>
          )}

          <div className="stack">
            {lines.map((line, index) => (
              <KitLineRow
                key={line.uid}
                index={index}
                line={line}
                items={items}
                item={itemById.get(line.itemId)}
                onChange={(patch) => updateLine(line.uid, patch)}
                onRemove={() => removeLine(line.uid)}
              />
            ))}
          </div>

          {localError && <div className="alert">{localError}</div>}
          <ErrorBox error={save.error ?? archive.error} />

          <div className="row" style={{ marginTop: 4 }}>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button type="button" className="head-chip" onClick={onClose}>
              Отмена
            </button>
            <div className="grow" />
            {kit?.isActive && (
              <button
                type="button"
                className="btn-outline"
                style={{ color: 'var(--danger)' }}
                title="Комплект скроется, но уже созданные сметы не изменятся"
                onClick={async () => {
                  await archive.mutateAsync(kit.id);
                  onClose();
                }}
              >
                <IconTrash />В архив
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

function KitLineRow({
  index,
  line,
  items,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  line: LineForm;
  items: CatalogItem[];
  item: CatalogItem | undefined;
  onChange: (patch: Partial<LineForm>) => void;
  onRemove: () => void;
}) {
  const unit = item ? UNIT_LABELS[item.unit] : '';
  return (
    <div className="position" style={{ padding: 12 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="faint" style={{ minWidth: 18 }}>
          {index + 1}
        </span>
        <select
          className="input grow"
          value={line.itemId}
          onChange={(e) => onChange({ itemId: e.target.value })}
        >
          <option value="">— выберите позицию —</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="muted"
          style={{ color: 'var(--danger)' }}
          onClick={onRemove}
          aria-label="Удалить строку"
        >
          <IconTrash />
        </button>
      </div>

      <div className="form-row" style={{ marginTop: 10 }}>
        <Field label={`Количество${unit ? `, ${unit}` : ''}`}>
          <TextInput
            className="input-num"
            value={line.qty}
            onChange={(e) => onChange({ qty: e.target.value })}
            placeholder="1"
          />
        </Field>
        <Field label="Норма">
          <select
            className="input"
            value={line.qtyMode}
            onChange={(e) => onChange({ qtyMode: e.target.value as 'PER_ROOT' | 'FIXED' })}
          >
            <option value="PER_ROOT">{QTY_MODE_LABEL.PER_ROOT}</option>
            <option value="FIXED">{QTY_MODE_LABEL.FIXED}</option>
          </select>
        </Field>
        <Field label="Мин (необяз.)">
          <TextInput
            className="input-num"
            value={line.min}
            onChange={(e) => onChange({ min: e.target.value })}
            placeholder="—"
          />
        </Field>
        <Field label="Макс (необяз.)">
          <TextInput
            className="input-num"
            value={line.max}
            onChange={(e) => onChange({ max: e.target.value })}
            placeholder="—"
          />
        </Field>
      </div>

      <label className="row" style={{ gap: 8, marginTop: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={line.isOptional}
          onChange={(e) => onChange({ isOptional: e.target.checked })}
        />
        <span className="muted" style={{ fontSize: 13 }}>
          Необязательная позиция (можно снять при добавлении в смету)
        </span>
      </label>
    </div>
  );
}
