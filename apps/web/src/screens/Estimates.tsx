import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney } from '@yaspectr/core';
import type { EstimateStatus } from '@yaspectr/core';
import { useCreateEstimate, useEstimates } from '../api/hooks.js';
import { useAuth } from '../auth.js';
import { Modal } from '../modal.js';
import { Empty, ErrorBox, Field, IconPlus, Spinner, TextInput } from '../ui.js';

const STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: 'Черновик',
  SENT: 'Отправлена',
  APPROVED: 'Согласована',
  REJECTED: 'Отклонена',
  ARCHIVED: 'В архиве',
};

export function EstimatesScreen() {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, error } = useEstimates(search || undefined);
  const { can } = useAuth();

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">Сметы</h1>
          <div className="page-sub">Экспресс-расчёт на объекте и детальная смета «до винтика»</div>
        </div>
        {can('estimate:write') && (
          <button type="button" className="btn-outline" onClick={() => setCreating(!creating)}>
            <IconPlus />
            Новый расчёт
          </button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <TextInput
          placeholder="Поиск по номеру, объекту или клиенту"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ErrorBox error={error} />
        {isLoading && <Spinner label="Загрузка смет…" />}

        {data && data.items.length === 0 && (
          <Empty
            title="Смет пока нет"
            hint="Создайте первую — позиции добавляются из справочника одним нажатием."
          />
        )}

        {data?.items.map((estimate) => (
          <Link key={estimate.id} to={`/estimates/${estimate.id}`} className="position">
            <div className="position-head" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{estimate.number}</span>
                  <span className={`badge${estimate.status === 'DRAFT' ? ' badge-muted' : ''}`}>
                    {STATUS_LABELS[estimate.status]}
                  </span>
                </div>
                <div className="position-name">{estimate.title}</div>
                <div className="position-sub">
                  {[estimate.clientName, estimate.siteAddress].filter(Boolean).join(' · ') ||
                    'Без клиента'}
                </div>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--accent-dark)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatMoney(estimate.grandTotal)}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {creating && <CreateForm onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateEstimate();
  const [form, setForm] = useState({ title: '', clientName: '', siteAddress: '', clientPhone: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const estimate = await create.mutateAsync({
      title: form.title.trim(),
      clientName: form.clientName.trim() || null,
      siteAddress: form.siteAddress.trim() || null,
      // Пустой телефон — null, а не пустая строка: схема на сервере проверяет
      // формат и пустую строку не примет.
      clientPhone: form.clientPhone.trim() || null,
      positions: [],
    });
    navigate(`/estimates/${estimate.id}`);
  }

  const fieldError = (name: string) =>
    create.error && 'fields' in create.error
      ? (create.error as { fields?: Record<string, string> }).fields?.[name]
      : undefined;

  return (
    <Modal title="Новый расчёт" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Название или объект" error={fieldError('title')}>
          <TextInput
            required
            placeholder="Офис на Ленина, 12"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>

        <Field label="Заказчик" error={fieldError('clientName')}>
          <TextInput
            placeholder="ООО «Альфа»"
            value={form.clientName}
            onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          />
        </Field>

        <Field label="Адрес объекта" error={fieldError('siteAddress')}>
          <TextInput
            placeholder="г. Пермь, ул. Ленина, 12"
            value={form.siteAddress}
            onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
          />
        </Field>

        <Field label="Телефон" error={fieldError('clientPhone')}>
          <TextInput
            placeholder="+7 900 123-45-67"
            value={form.clientPhone}
            onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
          />
        </Field>

        <ErrorBox error={create.error} />

        <div className="row" style={{ marginTop: 4 }}>
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Создание…' : 'Создать'}
          </button>
          <button type="button" className="head-chip" onClick={onClose}>
            Отмена
          </button>
        </div>
      </form>
    </Modal>
  );
}
