import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ActStatus } from '@yaspectr/core';
import { useActs, useCreateActFromEstimate, useEstimates } from '../api/hooks.js';
import { useAuth } from '../auth.js';
import { Modal } from '../modal.js';
import { Empty, ErrorBox, Field, IconPlus, Spinner, TextInput } from '../ui.js';

const STATUS_LABELS: Record<ActStatus, string> = {
  OPEN: 'Открыт',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнен',
  SENT: 'Отправлен',
};

export function ActsScreen() {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error } = useActs(search || undefined);
  const { can } = useAuth();

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">Акты работ</h1>
          <div className="page-sub">Чек-лист для монтажника на объекте</div>
        </div>
        {can('act:write') && (
          <button type="button" className="btn-outline" onClick={() => setCreating(!creating)}>
            <IconPlus />
            Новый акт
          </button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <TextInput
          placeholder="Поиск по номеру или объекту"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ErrorBox error={error} />
        {isLoading && <Spinner label="Загрузка актов…" />}

        {data && data.items.length === 0 && (
          <Empty
            title="Актов пока нет"
            hint="Акт собирается из готовой сметы: чек-лист заполнится работами автоматически."
          />
        )}

        {data?.items.map((act) => (
          <Link key={act.id} to={`/acts/${act.id}`} className="position">
            <div className="position-head" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{act.number}</span>
                  <span className={`badge${act.status === 'DONE' ? '' : ' badge-muted'}`}>
                    {STATUS_LABELS[act.status]}
                  </span>
                </div>
                <div className="position-name">{act.siteAddress}</div>
                <div className="position-sub">
                  {act.installerName} · {new Date(act.workDate).toLocaleDateString('ru-RU')} ·{' '}
                  {act._count.items} пунктов
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {creating && <CreateActForm onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateActForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateActFromEstimate();
  const { data: estimates } = useEstimates();
  const { user } = useAuth();

  const [estimateId, setEstimateId] = useState('');
  const [installerName, setInstallerName] = useState(user?.fullName ?? '');
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [includeMaterials, setIncludeMaterials] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const act = await create.mutateAsync({
      estimateId,
      installerName: installerName.trim(),
      workDate,
      includeMaterials,
    });
    navigate(`/acts/${act.id}`);
  }

  return (
    <Modal title="Акт из сметы" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Смета">
          <select
            className="input"
            required
            value={estimateId}
            onChange={(e) => setEstimateId(e.target.value)}
          >
            <option value="">Выберите смету</option>
            {estimates?.items.map((estimate) => (
              <option key={estimate.id} value={estimate.id}>
                {estimate.number} — {estimate.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Монтажник">
          <TextInput
            required
            value={installerName}
            onChange={(e) => setInstallerName(e.target.value)}
          />
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
          <span style={{ fontSize: 13 }}>Включить материалы (по умолчанию только работы)</span>
        </label>

        <ErrorBox error={create.error} />

        <div className="row" style={{ marginTop: 4 }}>
          <button type="submit" className="btn-primary" disabled={create.isPending || !estimateId}>
            {create.isPending ? 'Создание…' : 'Создать акт'}
          </button>
          <button type="button" className="head-chip" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
