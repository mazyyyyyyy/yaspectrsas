import { useState, type FormEvent } from 'react';
import {
  ITEM_KIND_LABELS,
  UNIT_LABELS,
  formatMoney,
  parseMoney,
  suggestIcon,
} from '@yaspectr/core';
import type { ItemKind, Unit } from '@yaspectr/core';
import { useArchiveCatalogItem, useCatalog, useSaveCatalogItem } from '../api/hooks.js';
import type { CatalogItem } from '../api/types.js';
import { useAuth } from '../auth.js';
import { CatalogIcon } from '../catalog-icons.js';
import { IconField } from '../icon-picker.js';
import { Modal } from '../modal.js';
import { ErrorBox, Field, IconPlus, IconTrash, Spinner, TextInput } from '../ui.js';

export function CatalogScreen() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const { data, isLoading, error } = useCatalog(search || undefined);
  const { can } = useAuth();

  const canEdit = can('catalog:write');
  const showCost = can('costPrice:read');

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">База позиций</h1>
          <div className="page-sub">
            У каждой позиции две цены: за материал и за работу. У кабеля это метр кабеля и
            метр прокладки.
          </div>
        </div>
        {canEdit && (
          <button type="button" className="btn-outline" onClick={() => setEditing('new')}>
            <IconPlus />
            Добавить позицию
          </button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <TextInput
          placeholder="Поиск по названию или артикулу"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ErrorBox error={error} />
        {isLoading && <Spinner label="Загрузка справочника…" />}

        {data && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Тип</th>
                  <th>Ед.</th>
                  <th className="right">Материал</th>
                  <th className="right">Работа</th>
                  {showCost && <th className="right">Закупка</th>}
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className={item.isActive ? undefined : 'line-off'}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="cell-icon">
                          <CatalogIcon id={item.icon} size={17} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 500 }}>{item.name}</div>
                          {item.sku && (
                            <div className="faint" style={{ fontSize: 11 }}>
                              {item.sku}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{ITEM_KIND_LABELS[item.kind]}</td>
                    <td className="muted">{UNIT_LABELS[item.unit]}</td>
                    <td className="right">
                      {item.materialPrice ? formatMoney(item.materialPrice) : '—'}
                    </td>
                    <td className="right">{item.laborPrice ? formatMoney(item.laborPrice) : '—'}</td>
                    {/* Закупку сервер вырезает из ответа для монтажника,
                        поэтому поля может не быть вовсе. */}
                    {showCost && (
                      <td className="right muted">
                        {item.costPrice ? formatMoney(item.costPrice) : '—'}
                      </td>
                    )}
                    {canEdit && (
                      <td className="right">
                        <button
                          type="button"
                          className="muted"
                          style={{ fontSize: 13 }}
                          onClick={() => setEditing(item)}
                        >
                          Изменить
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <ItemModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

const KINDS: ItemKind[] = ['EQUIPMENT', 'MATERIAL', 'LABOR', 'CABLE'];
const UNITS: Unit[] = ['PCS', 'M', 'SET', 'HOUR'];

function ItemModal({ item, onClose }: { item: CatalogItem | null; onClose: () => void }) {
  const save = useSaveCatalogItem();
  const archive = useArchiveCatalogItem();
  const { can } = useAuth();

  const [form, setForm] = useState({
    name: item?.name ?? '',
    sku: item?.sku ?? '',
    kind: item?.kind ?? ('EQUIPMENT' as ItemKind),
    unit: item?.unit ?? ('PCS' as Unit),
    icon: item?.icon ?? null,
    materialPrice: item ? formatMoney(item.materialPrice, { currency: false }) : '0',
    laborPrice: item ? formatMoney(item.laborPrice, { currency: false }) : '0',
    costPrice: item?.costPrice ? formatMoney(item.costPrice, { currency: false }) : '',
  });
  /** Пользователь трогал выбор иконки — подсказка больше не вмешивается. */
  const [iconTouched, setIconTouched] = useState(Boolean(item?.icon));

  /**
   * Пока иконку не выбрали руками, подставляем догадку по названию и типу.
   * Это только предзаполнение: значение видно в поле и меняется одним
   * нажатием, а в базу уходит именно то, что видит пользователь.
   */
  const changeName = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      icon: iconTouched ? prev.icon : suggestIcon(name, prev.kind),
    }));
  };

  const changeKind = (kind: ItemKind) => {
    setForm((prev) => ({
      ...prev,
      kind,
      icon: iconTouched ? prev.icon : suggestIcon(prev.name, kind),
      // У кабеля единица измерения всегда метры — избавляем от лишнего шага.
      unit: kind === 'CABLE' ? 'M' : prev.unit,
    }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync({
      id: item?.id,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      kind: form.kind,
      unit: form.unit,
      icon: form.icon,
      materialPrice: parseMoney(form.materialPrice) ?? 0,
      laborPrice: parseMoney(form.laborPrice) ?? 0,
      costPrice: form.costPrice ? parseMoney(form.costPrice) : null,
    });
    onClose();
  }

  const fieldError = (name: string) =>
    save.error && 'fields' in save.error
      ? (save.error as { fields?: Record<string, string> }).fields?.[name]
      : undefined;

  const isCable = form.kind === 'CABLE';

  return (
    <Modal title={item ? 'Позиция справочника' : 'Новая позиция'} onClose={onClose} width={600}>
      <form className="stack" onSubmit={submit}>
        <Field label="Наименование" error={fieldError('name')}>
          <TextInput
            required
            value={form.name}
            onChange={(e) => changeName(e.target.value)}
            placeholder="IP камера 4 Мп"
          />
        </Field>

        <IconField
          value={form.icon}
          onChange={(icon) => {
            setIconTouched(true);
            setForm((prev) => ({ ...prev, icon }));
          }}
        />

        <div className="form-row">
          <Field label="Артикул" error={fieldError('sku')}>
            <TextInput value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label="Тип">
            <select
              className="input"
              value={form.kind}
              onChange={(e) => changeKind(e.target.value as ItemKind)}
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {ITEM_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Единица">
            <select
              className="input"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="form-row">
          <Field label={isCable ? 'Материал, ₽/м' : 'Материал, ₽'} error={fieldError('materialPrice')}>
            <TextInput
              className="input-num"
              value={form.materialPrice}
              onChange={(e) => setForm({ ...form, materialPrice: e.target.value })}
            />
          </Field>
          <Field label={isCable ? 'Прокладка, ₽/м' : 'Работа, ₽'}>
            <TextInput
              className="input-num"
              value={form.laborPrice}
              onChange={(e) => setForm({ ...form, laborPrice: e.target.value })}
            />
          </Field>
          {can('costPrice:read') && (
            <Field label="Закупка, ₽">
              <TextInput
                className="input-num"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </Field>
          )}
        </div>

        <ErrorBox error={save.error ?? archive.error} />

        <div className="row" style={{ marginTop: 4 }}>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button type="button" className="head-chip" onClick={onClose}>
            Отмена
          </button>
          <div className="grow" />
          {item?.isActive && (
            <button
              type="button"
              className="btn-outline"
              style={{ color: 'var(--danger)' }}
              title="Позиция скроется из справочника, но останется в уже созданных сметах"
              onClick={async () => {
                await archive.mutateAsync(item.id);
                onClose();
              }}
            >
              <IconTrash />В архив
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
