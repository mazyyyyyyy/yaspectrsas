import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { UNIT_LABELS, formatQty } from '@yaspectr/core';
import { useActs, useCreateActFromEstimate, useToggleActItem } from '../api/hooks.js';
import type { Estimate } from '../api/types.js';
import { useAuth } from '../auth.js';
import { ErrorBox, Field, IconCheck, Spinner, TextInput } from '../ui.js';

/**
 * Вкладка «Акт выполненных работ» внутри сметы — третья поверхность из ТЗ.
 * Если акта по этой смете ещё нет, предлагаем собрать чек-лист из её работ.
 */
export function ActTab({ estimate }: { estimate: Estimate }) {
  const { data, isLoading } = useActs();
  const { can } = useAuth();

  if (isLoading) return <Spinner label="Загрузка акта…" />;

  const act = data?.items.find((candidate) => candidate.estimateId === estimate.id);

  if (!act) {
    return can('act:write') ? (
      <CreateAct estimate={estimate} />
    ) : (
      <div className="card muted">По этой смете акт ещё не создан.</div>
    );
  }

  return <ActChecklist actId={act.id} />;
}

function CreateAct({ estimate }: { estimate: Estimate }) {
  const create = useCreateActFromEstimate();
  const { user } = useAuth();
  const [installerName, setInstallerName] = useState(user?.fullName ?? '');
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [includeMaterials, setIncludeMaterials] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({
      estimateId: estimate.id,
      installerName: installerName.trim(),
      workDate,
      includeMaterials,
    });
  }

  return (
    <form className="card stack" style={{ maxWidth: 520 }} onSubmit={submit}>
      <h2 className="section-title" style={{ flex: 'none' }}>
        Собрать акт из этой сметы
      </h2>
      <div className="muted" style={{ fontSize: 13 }}>
        Чек-лист заполнится работами из сметы. Суммы в акт не переносятся — он
        подтверждает выполнение, а не цену.
      </div>

      <Field label="Монтажник">
        <TextInput required value={installerName} onChange={(e) => setInstallerName(e.target.value)} />
      </Field>

      <Field label="Дата работ">
        <TextInput
          type="date"
          required
          value={workDate}
          onChange={(e) => setWorkDate(e.target.value)}
        />
      </Field>

      <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={includeMaterials}
          onChange={(e) => setIncludeMaterials(e.target.checked)}
        />
        <span style={{ fontSize: 13 }}>Включить материалы</span>
      </label>

      <ErrorBox error={create.error} />

      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {create.isPending ? 'Создание…' : 'Создать акт'}
      </button>
    </form>
  );
}

export function ActChecklist({ actId }: { actId: string }) {
  const { data: acts } = useActs();
  const toggle = useToggleActItem(actId);
  const { user, can } = useAuth();

  const listItem = acts?.items.find((a) => a.id === actId);
  // Полный акт с пунктами лежит в кеше после мутации; до неё берём его
  // отдельным экраном по ссылке.
  const act = toggle.data ?? null;
  const items = act?.items ?? [];

  const canCheck = can('act:write') && user?.role !== 'INSTALLER';

  if (!act) {
    return (
      <div className="card stack">
        <div className="row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{listItem?.number}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {listItem?.installerName} · {listItem?._count.items} пунктов
            </div>
          </div>
          <Link to={`/acts/${actId}`} className="btn-outline">
            Открыть чек-лист
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {items.map((item) => (
        <div
          key={item.id}
          className="row"
          style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={() =>
              void toggle.mutateAsync({
                itemId: item.id,
                isDone: !item.isDone,
              })
            }
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: `2px solid ${item.isDone ? 'var(--accent)' : 'var(--border-strong)'}`,
              background: item.isDone ? 'var(--accent)' : 'var(--surface)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            {item.isDone && <IconCheck />}
          </button>

          <div className="grow">
            <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
            <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
              {formatQty(item.qtyPlanned, UNIT_LABELS[item.unit])}
            </div>
          </div>

          {canCheck && (
            <button
              type="button"
              className={item.isChecked ? 'btn-primary' : 'btn-outline'}
              style={{ padding: '7px 12px', boxShadow: 'none' }}
              onClick={() => void toggle.mutateAsync({ itemId: item.id, isChecked: !item.isChecked })}
            >
              {item.isChecked ? 'Проверено' : 'Проверить'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
