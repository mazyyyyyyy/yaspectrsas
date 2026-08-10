import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ITEM_KIND_LABELS,
  UNIT_LABELS,
  formatMoney,
  formatQty,
  parseMoney,
  parseQty,
} from '@yaspectr/core';
import type { ItemKind, Kopecks, QtyMilli, Unit } from '@yaspectr/core';
import { downloadFile } from '../api/client.js';
import {
  useAddPosition,
  useCatalog,
  useEstimate,
  useRemovePosition,
  useDeleteEstimate,
  useSetEstimateStatus,
  useUpdateEstimate,
  useUpdateLine,
  useUpdatePositionQty,
} from '../api/hooks.js';
import type { Estimate, EstimateLine, EstimatePosition, ResyncChange } from '../api/types.js';
import { useAuth } from '../auth.js';
import { CatalogIcon } from '../catalog-icons.js';
import { Modal } from '../modal.js';
import {
  BackLink,
  ErrorBox,
  IconActTab,
  IconBolt,
  IconCheckCircle,
  IconChevronRight,
  IconDoc,
  IconDots,
  IconPdf,
  IconPlus,
  IconSave,
  IconSend,
  IconTrash,
  Field,
  Spinner,
  TextInput,
} from '../ui.js';
import { ActTab } from './ActTab.js';

type Tab = 'express' | 'detailed' | 'act';

// В React 19 глобального пространства имён JSX больше нет — тип элемента
// берём из самого пакета.
const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => ReactElement }[] = [
  { id: 'express', label: 'Экспресс-расчёт', Icon: IconBolt },
  { id: 'detailed', label: 'Детальная смета', Icon: IconDoc },
  { id: 'act', label: 'Акт выполненных работ', Icon: IconActTab },
];

export function EstimateScreen() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: estimate, isLoading, error } = useEstimate(id);
  const [changes, setChanges] = useState<ResyncChange[] | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { can } = useAuth();

  const tab = (params.get('view') as Tab) || 'express';
  const setTab = (next: Tab) => setParams(next === 'express' ? {} : { view: next });

  const editable = estimate?.status === 'DRAFT' || estimate?.status === 'REJECTED';
  const canEdit = can('estimate:write') && editable;

  if (isLoading) return <Spinner label="Загрузка сметы…" />;
  if (error) return <ErrorBox error={error} />;
  if (!estimate) return null;

  return (
    <>
      <PageHead estimate={estimate} />

      <div className="tabs">
        {TABS.map(({ id: tabId, label, Icon }) => (
          <button
            key={tabId}
            type="button"
            className={`tab${tab === tabId ? ' active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'act' ? (
        <div style={{ marginTop: 26 }}>
          <ActTab estimate={estimate} />
        </div>
      ) : (
        <CalcView
          estimate={estimate}
          detailed={tab === 'detailed'}
          canEdit={canEdit}
          changes={changes}
          onChanges={setChanges}
          exportError={exportError}
          onExportError={setExportError}
        />
      )}
    </>
  );
}

function PageHead({ estimate }: { estimate: Estimate }) {
  const [editing, setEditing] = useState(false);
  const statusLabel =
    estimate.status === 'DRAFT'
      ? 'Черновик сохранён'
      : estimate.status === 'SENT'
        ? 'Отправлена клиенту'
        : estimate.status === 'APPROVED'
          ? 'Согласована'
          : estimate.status === 'REJECTED'
            ? 'Отклонена'
            : 'В архиве';

  return (
    <>
      <BackLink to="/estimates">Все сметы</BackLink>

      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">{estimate.title}</h1>
          <div className="page-sub">
            {estimate.number}
            {estimate.siteAddress ? `  •  Объект: ${estimate.siteAddress}` : ''}
            {estimate.clientName ? `  •  Клиент: ${estimate.clientName}` : ''}
          </div>
        </div>

        <div className="head-chip">
          <IconCheckCircle />
          {statusLabel}
        </div>

        <HeadMenu estimate={estimate} onEdit={() => setEditing(true)} />
      </div>

      {editing && <EditHeaderForm estimate={estimate} onClose={() => setEditing(false)} />}
    </>
  );
}

/**
 * Меню «⋮» — действия над сметой целиком.
 *
 * В макете это была просто нарисованная кнопка. Здесь за ней настоящие
 * операции: правка шапки, смена статуса и удаление.
 */
function HeadMenu({ estimate, onEdit }: { estimate: Estimate; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const setStatus = useSetEstimateStatus(estimate.id);
  const remove = useDeleteEstimate();
  const { can } = useAuth();

  // Закрытие по клику вне меню и по Escape — иначе выпадашка залипает
  // и перекрывает содержимое страницы.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isDraft = estimate.status === 'DRAFT' || estimate.status === 'REJECTED';

  const run = async (fn: () => Promise<unknown>) => {
    setOpen(false);
    await fn();
  };

  return (
    <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Действия со сметой"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <IconDots />
      </button>

      {open && (
        <div role="menu" className="menu">
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Изменить данные
          </button>

          {isDraft ? (
            <button
              type="button"
              className="menu-item"
              disabled={setStatus.isPending}
              onClick={() => void run(() => setStatus.mutateAsync('SENT'))}
            >
              Отметить отправленной
            </button>
          ) : (
            <button
              type="button"
              className="menu-item"
              disabled={setStatus.isPending}
              onClick={() => void run(() => setStatus.mutateAsync('DRAFT'))}
            >
              Вернуть в черновик
            </button>
          )}

          {estimate.status === 'SENT' && (
            <button
              type="button"
              className="menu-item"
              disabled={setStatus.isPending}
              onClick={() => void run(() => setStatus.mutateAsync('APPROVED'))}
            >
              Отметить согласованной
            </button>
          )}

          {estimate.status !== 'ARCHIVED' && (
            <button
              type="button"
              className="menu-item"
              disabled={setStatus.isPending}
              onClick={() => void run(() => setStatus.mutateAsync('ARCHIVED'))}
            >
              В архив
            </button>
          )}

          {can('estimate:delete') && (
            <button
              type="button"
              className="menu-item danger"
              disabled={remove.isPending}
              onClick={() =>
                void run(async () => {
                  // Удаление необратимо — спрашиваем прямо.
                  if (!window.confirm(`Удалить смету ${estimate.number}? Это нельзя отменить.`)) {
                    return;
                  }
                  await remove.mutateAsync(estimate.id);
                  navigate('/estimates');
                })
              }
            >
              Удалить смету
            </button>
          )}
        </div>
      )}

      {(setStatus.error || remove.error) && (
        <div className="alert" style={{ position: 'absolute', right: 0, top: 48, width: 260 }}>
          {(setStatus.error ?? remove.error) instanceof Error
            ? ((setStatus.error ?? remove.error) as Error).message
            : 'Не удалось выполнить действие'}
        </div>
      )}
    </div>
  );
}

/** Правка шапки сметы: название, заказчик, объект, телефон. */
function EditHeaderForm({ estimate, onClose }: { estimate: Estimate; onClose: () => void }) {
  const update = useUpdateEstimate(estimate.id);
  const [form, setForm] = useState({
    title: estimate.title,
    clientName: estimate.clientName ?? '',
    siteAddress: estimate.siteAddress ?? '',
    clientPhone: estimate.clientPhone ?? '',
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await update.mutateAsync({
      title: form.title.trim(),
      clientName: form.clientName.trim() || null,
      siteAddress: form.siteAddress.trim() || null,
      // Пустой телефон — null: схема на сервере проверяет формат
      // и пустую строку не примет.
      clientPhone: form.clientPhone.trim() || null,
    });
    onClose();
  }

  const fieldError = (name: string) =>
    update.error && 'fields' in update.error
      ? (update.error as { fields?: Record<string, string> }).fields?.[name]
      : undefined;

  return (
    <Modal title="Данные сметы" onClose={onClose}>
      <form className="stack" onSubmit={submit}>

      <Field label="Название или объект" error={fieldError('title')}>
        <TextInput
          required
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>

      <Field label="Заказчик" error={fieldError('clientName')}>
        <TextInput
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
        />
      </Field>

      <Field label="Адрес объекта" error={fieldError('siteAddress')}>
        <TextInput
          value={form.siteAddress}
          onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
        />
      </Field>

      <Field label="Телефон" error={fieldError('clientPhone')}>
        <TextInput
          value={form.clientPhone}
          onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
        />
      </Field>

      <ErrorBox error={update.error} />

      <div className="row">
        <button type="submit" className="btn-primary" disabled={update.isPending}>
          {update.isPending ? 'Сохранение…' : 'Сохранить'}
        </button>
          <button type="button" className="head-chip" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CalcView({
  estimate,
  detailed,
  canEdit,
  changes,
  onChanges,
  exportError,
  onExportError,
}: {
  estimate: Estimate;
  detailed: boolean;
  canEdit: boolean;
  changes: ResyncChange[] | null;
  onChanges: (c: ResyncChange[] | null) => void;
  exportError: string | null;
  onExportError: (e: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      {changes && changes.length > 0 && (
        <div className="notice" style={{ marginTop: 20 }}>
          <div className="row">
            <strong className="grow">Комплект пересчитан</strong>
            <button type="button" className="muted" onClick={() => onChanges(null)}>
              Закрыть
            </button>
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {changes.map((change) => (
              <li key={`${change.type}-${change.lineId}`}>
                {change.name} —{' '}
                {change.type === 'qty-updated'
                  ? `${formatQty(change.fromQty ?? 0)} → ${formatQty(change.toQty ?? 0)}`
                  : change.type === 'line-added'
                    ? 'добавлено'
                    : change.type === 'line-orphaned'
                      ? 'нет в шаблоне'
                      : 'сохранено как ручное'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="calc-grid">
        <div className="calc-main">
          <Tiles estimate={estimate} />

          <div className="section-head">
            <h2 className="section-title">Позиции</h2>
            {canEdit && (
              <button type="button" className="btn-outline" onClick={() => setAdding(!adding)}>
                <IconPlus />
                Добавить позицию
              </button>
            )}
          </div>

          {adding && canEdit && (
            <div style={{ marginTop: 14 }}>
              <AddPosition estimateId={estimate.id} onDone={() => setAdding(false)} />
            </div>
          )}

          <div className="positions">
            {estimate.positions.length === 0 && (
              <div className="card muted" style={{ textAlign: 'center' }}>
                Позиций нет. Добавьте камеру или регистратор — комплект развернётся сам.
              </div>
            )}

            {estimate.positions.map((position, index) => (
              <Position
                key={position.id}
                estimate={estimate}
                position={position}
                index={index}
                detailed={detailed}
                canEdit={canEdit}
                onChanges={onChanges}
              />
            ))}
          </div>
        </div>

        <Totals
          estimate={estimate}
          canEdit={canEdit}
          detailed={detailed}
          exportError={exportError}
          onExportError={onExportError}
        />
      </div>

      <MobileActions estimate={estimate} detailed={detailed} onExportError={onExportError} />
    </>
  );
}

function Tiles({ estimate }: { estimate: Estimate }) {
  if (estimate.groups.length === 0) return null;

  return (
    <div className="tiles">
      {estimate.groups.map((group) => (
        <div key={group.catalogItemId ?? group.name} className="tile">
          <div className="tile-label">
            <span style={{ color: 'var(--accent-icon)', display: 'flex' }}>
              <CatalogIcon id={group.icon} size={17} />
            </span>
            {shortLabel(group.name)}
          </div>
          <div className="tile-value">
            {formatQty(group.qty)} <span>шт.</span>
          </div>
          {/* Цена «под ключ» — с работами и комплектом, а не голое железо. */}
          <div className="tile-price">{formatMoney(group.total)}</div>
        </div>
      ))}
    </div>
  );
}

/** «IP камера 4 Мп» → «Камеры»: в плитке нужен тип, а не полное название. */
function shortLabel(name: string): string {
  const text = name.toLowerCase();
  if (text.includes('камер')) return 'Камеры';
  if (text.includes('wi-fi') || text.includes('wifi') || text.includes('точка доступа'))
    return 'Wi-Fi';
  if (text.includes('домофон')) return 'Домофон';
  if (text.includes('регистратор')) return 'Регистратор';
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

// ─────────────────────────────────────────────────────────────
// Позиция и её строки
// ─────────────────────────────────────────────────────────────

/**
 * Строка таблицы для показа.
 *
 * У позиции справочника две цены — за материал и за работу. В макете это
 * были две отдельные строки («Кабель UTP (материал)» и «Прокладка кабеля»),
 * и для пятиколоночной таблицы с одной ценой за единицу так и нужно.
 * Поэтому строку с обеими ценами разворачиваем в две: данные остаются одной
 * записью, а выглядит как в макете.
 */
interface DisplayRow {
  key: string;
  lineId: string;
  name: string;
  kind: ItemKind;
  qty: QtyMilli;
  unit: Unit;
  unitPrice: Kopecks;
  sum: Kopecks;
  field: 'unitMaterialPrice' | 'unitLaborPrice';
  isCable: boolean;
  isEnabled: boolean;
}

function toDisplayRows(
  line: EstimateLine,
  totals: { material: Kopecks; labor: Kopecks } | undefined,
): DisplayRow[] {
  const base = {
    lineId: line.id,
    kind: line.kind,
    qty: line.qty,
    unit: line.unit,
    isCable: line.kind === 'CABLE',
    isEnabled: line.isEnabled,
  };

  const hasMaterial = line.unitMaterialPrice > 0;
  const hasLabor = line.unitLaborPrice > 0;
  const both = hasMaterial && hasLabor;

  const rows: DisplayRow[] = [];

  if (hasMaterial || !hasLabor) {
    rows.push({
      ...base,
      key: `${line.id}-m`,
      name: both ? `${line.name} (материал)` : line.name,
      unitPrice: line.unitMaterialPrice,
      sum: totals?.material ?? 0,
      field: 'unitMaterialPrice',
    });
  }

  if (hasLabor) {
    rows.push({
      ...base,
      key: `${line.id}-l`,
      name: both ? `${line.name} — ${line.kind === 'CABLE' ? 'прокладка' : 'работа'}` : line.name,
      unitPrice: line.unitLaborPrice,
      sum: totals?.labor ?? 0,
      field: 'unitLaborPrice',
    });
  }

  return rows;
}

function Position({
  estimate,
  position,
  index,
  detailed,
  canEdit,
  onChanges,
}: {
  estimate: Estimate;
  position: EstimatePosition;
  index: number;
  detailed: boolean;
  canEdit: boolean;
  onChanges: (c: ResyncChange[]) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const updateQty = useUpdatePositionQty(estimate.id);
  const remove = useRemovePosition(estimate.id);

  const totals = estimate.totals.positions[index];
  const expanded = open || detailed;

  async function changeQty(raw: string) {
    const parsed = parseQty(raw);
    if (parsed === null || parsed <= 0 || parsed === position.qty) return;
    const result = await updateQty.mutateAsync({ positionId: position.id, qty: parsed });
    if (result.changes?.length) onChanges(result.changes);
  }

  return (
    <div className="position">
      <button type="button" className="position-head" onClick={() => setOpen(!open)}>
        <IconChevronRight open={expanded} />
        <div className="position-num">{index + 1}</div>
        <div className="position-icon">
          <CatalogIcon id={position.icon} size={16} />
        </div>
        <div className="grow">
          <div className="position-name">{position.name}</div>
          <div className="position-sub">
            {formatQty(position.qty, UNIT_LABELS[position.unit])} ×{' '}
            {formatMoney(position.unitMaterialPrice + position.unitLaborPrice)}
          </div>
        </div>
        <div className="position-total">{formatMoney(totals?.total ?? 0)}</div>
      </button>

      {expanded && (
        <div className="position-body">
          {canEdit && detailed && (
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="field-label">Количество</span>
              <input
                className="cell-input"
                style={{ width: 100 }}
                defaultValue={formatQty(position.qty)}
                // Пересчёт по потере фокуса, а не на каждое нажатие: иначе
                // набор «10» отправит запрос ещё и для промежуточной «1».
                onBlur={(e) => void changeQty(e.target.value)}
                disabled={updateQty.isPending}
              />
              <div className="grow" />
              <button
                type="button"
                className="btn-outline"
                style={{ color: 'var(--danger)' }}
                onClick={() => void remove.mutateAsync(position.id)}
                disabled={remove.isPending}
              >
                <IconTrash />
                Удалить
              </button>
            </div>
          )}

          <div className="lines">
            <div className="lines-head">
              <div>Наименование</div>
              <div>Тип</div>
              <div>Кол-во</div>
              <div style={{ textAlign: 'right' }}>Цена за ед.</div>
              <div style={{ textAlign: 'right' }}>Сумма</div>
            </div>

            {position.lines.flatMap((line, lineIndex) =>
              toDisplayRows(line, totals?.lines[lineIndex]).map((row) => (
                <Row
                  key={row.key}
                  estimateId={estimate.id}
                  row={row}
                  positionQty={position.qty}
                  editable={canEdit && detailed}
                />
              )),
            )}
          </div>

          <ErrorBox error={updateQty.error ?? remove.error} />
        </div>
      )}
    </div>
  );
}

function Row({
  estimateId,
  row,
  positionQty,
  editable,
}: {
  estimateId: string;
  row: DisplayRow;
  positionQty: QtyMilli;
  editable: boolean;
}) {
  const update = useUpdateLine(estimateId);
  const commit = (patch: Record<string, unknown>) =>
    void update.mutateAsync({ lineId: row.lineId, ...patch });

  return (
    <div className={`lines-row${row.isEnabled ? '' : ' line-off'}`}>
      <div className="name">{row.name}</div>
      <div className="type">{ITEM_KIND_LABELS[row.kind]}</div>

      <div className="qty">
        {editable ? (
          <input
            className="cell-input"
            defaultValue={formatQty(row.qty)}
            onBlur={(e) => {
              const parsed = parseQty(e.target.value);
              if (parsed !== null && parsed !== row.qty) commit({ qty: parsed });
            }}
          />
        ) : row.isCable ? (
          // Кабель в свёрнутом виде — быстрый выбор длины, как в макете.
          <CableSelect
            qty={row.qty}
            positionQty={positionQty}
            onChange={(qty) => commit({ qty })}
            disabled={update.isPending}
          />
        ) : (
          formatQty(row.qty, UNIT_LABELS[row.unit])
        )}
      </div>

      <div className="right price">
        {editable ? (
          <input
            className="cell-input"
            defaultValue={formatMoney(row.unitPrice, { currency: false })}
            onBlur={(e) => {
              const parsed = parseMoney(e.target.value);
              if (parsed !== null && parsed !== row.unitPrice) commit({ [row.field]: parsed });
            }}
          />
        ) : (
          formatMoney(row.unitPrice)
        )}
      </div>

      <div className="sum">{formatMoney(row.sum)}</div>
    </div>
  );
}

/**
 * Быстрый выбор длины кабеля.
 *
 * Варианты строим от количества базовых позиций (30/40/50 м на точку — типовой
 * диапазон из шаблона) и обязательно добавляем текущее значение. Иначе
 * замеренные монтажником 205 м не попали бы в список и молча заменились
 * ближайшим вариантом при первом же открытии.
 */
function CableSelect({
  qty,
  positionQty,
  onChange,
  disabled,
}: {
  qty: QtyMilli;
  positionQty: QtyMilli;
  onChange: (qty: QtyMilli) => void;
  disabled: boolean;
}) {
  const options = useMemo(() => {
    const units = Math.max(1, Math.round(positionQty / 1000));
    const presets = [30, 40, 50, 60, 80].map((perUnit) => perUnit * units * 1000);
    return [...new Set([...presets, qty])].sort((a, b) => a - b);
  }, [positionQty, qty]);

  return (
    <select
      className="select-sm"
      value={String(qty)}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {options.map((value) => (
        <option key={value} value={value}>
          {formatQty(value)} м
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────
// Панель итогов
// ─────────────────────────────────────────────────────────────

function Totals({
  estimate,
  canEdit,
  detailed,
  exportError,
  onExportError,
}: {
  estimate: Estimate;
  canEdit: boolean;
  detailed: boolean;
  exportError: string | null;
  onExportError: (e: string | null) => void;
}) {
  const update = useUpdateEstimate(estimate.id);
  const [saved, setSaved] = useState(false);
  const { totals } = estimate;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function download(format: 'pdf' | 'docx') {
    onExportError(null);
    try {
      await downloadFile(
        `/estimates/${estimate.id}/export?format=${format}&detail=${detailed ? 'full' : 'summary'}`,
        `smeta.${format}`,
      );
    } catch (cause) {
      onExportError(cause instanceof Error ? cause.message : 'Не удалось выгрузить документ');
    }
  }

  return (
    <div className="totals">
      <h2 className="totals-title">Итоги расчёта</h2>

      <div className="totals-row" style={{ marginTop: 20 }}>
        <span className="label">Материалы</span>
        <span className="value">{formatMoney(totals.materials)}</span>
      </div>

      <div className="totals-row" style={{ marginTop: 14 }}>
        <span className="label">Работы</span>
        <span className="value">{formatMoney(totals.labor)}</span>
      </div>

      <div className="totals-row" style={{ marginTop: 16, gap: 10 }}>
        <span className="label">Скидка</span>
        <select
          className="select-sm"
          value={String(estimate.discountBp)}
          disabled={!canEdit || update.isPending}
          onChange={(e) => void update.mutateAsync({ discountBp: Number(e.target.value) })}
        >
          {[0, 500, 1000, 1500].map((bp) => (
            <option key={bp} value={bp}>
              {bp / 100} %
            </option>
          ))}
        </select>
        <span
          style={{
            color: 'var(--danger)',
            fontWeight: 500,
            minWidth: 62,
            textAlign: 'right',
          }}
        >
          {totals.discount > 0 ? `−${formatMoney(totals.discount)}` : '0 ₽'}
        </span>
      </div>

      <div className="totals-divider" />

      <div className="totals-label">Предварительный итог</div>
      <div className="totals-grand">{formatMoney(totals.grandTotal)}</div>
      <div className="totals-note">Предварительно, детально — после выезда</div>

      <div className="totals-actions">
        {/* Правки сохраняются сразу при вводе; эта кнопка — явное
            подтверждение, к которому люди привыкли, и заодно фиксирует
            параметры шапки. */}
        <button
          type="button"
          className="btn-primary"
          disabled={!canEdit || update.isPending}
          onClick={async () => {
            await update.mutateAsync({ title: estimate.title });
            setSaved(true);
          }}
        >
          <IconSave />
          {saved ? 'Сохранено' : 'Сохранить'}
        </button>

        <button type="button" className="btn-secondary" onClick={() => void download('pdf')}>
          <IconPdf />
          Экспорт PDF
        </button>

        <button type="button" className="btn-secondary" onClick={() => void download('docx')}>
          <IconSend />
          Отправить клиенту
        </button>
      </div>

      {exportError && (
        <div className="alert" style={{ marginTop: 10 }}>
          {exportError}
        </div>
      )}
      <ErrorBox error={update.error} />
    </div>
  );
}

/** Нижняя панель действий из мобильного макета: Сохранить · PDF · Клиенту. */
function MobileActions({
  estimate,
  detailed,
  onExportError,
}: {
  estimate: Estimate;
  detailed: boolean;
  onExportError: (e: string | null) => void;
}) {
  const navigate = useNavigate();

  async function download(format: 'pdf' | 'docx') {
    onExportError(null);
    try {
      await downloadFile(
        `/estimates/${estimate.id}/export?format=${format}&detail=${detailed ? 'full' : 'summary'}`,
        `smeta.${format}`,
      );
    } catch (cause) {
      onExportError(cause instanceof Error ? cause.message : 'Не удалось выгрузить документ');
    }
  }

  return (
    <div className="mobile-actions">
      <button type="button" onClick={() => navigate('/estimates')}>
        <IconSave size={22} />
        Сохранить
      </button>
      <button type="button" onClick={() => void download('pdf')}>
        <IconPdf size={22} />
        PDF
      </button>
      <button type="button" onClick={() => void download('docx')}>
        <IconSend size={22} />
        Клиенту
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Добавление позиции
// ─────────────────────────────────────────────────────────────

function AddPosition({ estimateId, onDone }: { estimateId: string; onDone: () => void }) {
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState('1');
  const [selected, setSelected] = useState<string | null>(null);
  const { data } = useCatalog(search || undefined);
  const add = useAddPosition(estimateId);

  const options = useMemo(
    () => (data?.items ?? []).filter((item) => item.isActive && item.kind === 'EQUIPMENT'),
    [data],
  );

  async function submit() {
    const parsed = parseQty(qty);
    if (!selected || parsed === null || parsed <= 0) return;
    await add.mutateAsync({ catalogItemId: selected, qty: parsed });
    onDone();
  }

  return (
    <div className="card stack">
      <input
        className="input"
        placeholder="Найти позицию"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="stack" style={{ maxHeight: 240, overflowY: 'auto', gap: 6 }}>
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            className="head-chip"
            style={{
              justifyContent: 'space-between',
              width: '100%',
              borderColor: selected === item.id ? 'var(--accent)' : undefined,
              background: selected === item.id ? 'var(--surface-accent)' : undefined,
            }}
            onClick={() => setSelected(item.id)}
          >
            <span className="row" style={{ gap: 8 }}>
              <span style={{ color: 'var(--accent-icon)', display: 'flex' }}>
                <CatalogIcon id={item.icon} size={16} />
              </span>
              {item.name}
            </span>
            <span>{formatMoney(item.materialPrice)}</span>
          </button>
        ))}
        {options.length === 0 && <div className="muted">Ничего не найдено</div>}
      </div>

      <div className="row">
        <input
          className="input input-num"
          style={{ width: 90 }}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Количество"
        />
        <button
          type="button"
          className="btn-primary grow"
          disabled={!selected || add.isPending}
          onClick={() => void submit()}
        >
          {add.isPending ? 'Добавление…' : 'Добавить с комплектом'}
        </button>
        <button type="button" className="head-chip" onClick={onDone}>
          Отмена
        </button>
      </div>

      <ErrorBox error={add.error} />
    </div>
  );
}
