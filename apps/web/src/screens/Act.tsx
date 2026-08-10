import { useParams } from 'react-router-dom';
import { UNIT_LABELS, formatQty } from '@yaspectr/core';
import { useAct, useToggleActItem } from '../api/hooks.js';
import { useAuth } from '../auth.js';
import { BackLink, ErrorBox, IconCheck, Spinner } from '../ui.js';

/**
 * Экран монтажника. Рассчитан на телефон в руках на объекте: крупные области
 * нажатия, минимум текста, никаких цен — акт подтверждает выполнение работ,
 * а не стоимость.
 */
export function ActScreen() {
  const { id = '' } = useParams();
  const { data: act, isLoading, error } = useAct(id);
  const toggle = useToggleActItem(id);
  const { user, can } = useAuth();

  if (isLoading) return <Spinner label="Загрузка акта…" />;
  if (error) return <ErrorBox error={error} />;
  if (!act) return null;

  const done = act.items.filter((item) => item.isDone).length;
  const checked = act.items.filter((item) => item.isChecked).length;
  // «Проверено» ставит принимающий работу, не исполнитель. Сервер это тоже
  // проверяет — здесь просто не показываем бесполезную кнопку.
  const canCheck = can('act:write') && user?.role !== 'INSTALLER';

  return (
    <>
      <BackLink to="/acts">Все акты</BackLink>

      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">{act.siteAddress}</h1>
          <div className="page-sub">
            {act.number} · {act.installerName} ·{' '}
            {new Date(act.workDate).toLocaleDateString('ru-RU')}
          </div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <div className="card row" style={{ gap: 24 }}>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>
              Выполнено
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {done}
              <span className="faint" style={{ fontSize: 14, fontWeight: 500 }}>
                {' '}
                / {act.items.length}
              </span>
            </div>
          </div>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>
              Проверено
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {checked}
              <span className="faint" style={{ fontSize: 14, fontWeight: 500 }}>
                {' '}
                / {act.items.length}
              </span>
            </div>
          </div>
          <div className="grow" />
          <div
            style={{
              height: 6,
              width: 90,
              borderRadius: 999,
              background: 'var(--border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${act.items.length ? (done / act.items.length) * 100 : 0}%`,
                background: 'var(--accent)',
                transition: 'width .2s',
              }}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {act.items.map((item) => (
            <div key={item.id} className={`check-row${item.isDone ? ' check-done' : ''}`}>
              <button
                type="button"
                className="check"
                data-on={item.isDone}
                aria-label={item.isDone ? 'Отменить выполнение' : 'Отметить выполненным'}
                aria-pressed={item.isDone}
                disabled={toggle.isPending}
                onClick={() => void toggle.mutateAsync({ itemId: item.id, isDone: !item.isDone })}
              >
                {item.isDone && <IconCheck />}
              </button>

              <div className="grow check-label">
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                  {formatQty(item.qtyPlanned, UNIT_LABELS[item.unit])}
                  {item.isDone && item.qtyDone !== item.qtyPlanned
                    ? ` · выполнено ${formatQty(item.qtyDone, UNIT_LABELS[item.unit])}`
                    : ''}
                </div>
              </div>

              {canCheck && (
                <button
                  type="button"
                  className={item.isChecked ? 'btn-primary' : 'btn-outline'}
                  style={{ padding: '8px 14px', boxShadow: 'none' }}
                  disabled={toggle.isPending}
                  onClick={() =>
                    void toggle.mutateAsync({ itemId: item.id, isChecked: !item.isChecked })
                  }
                >
                  {item.isChecked ? 'Проверено' : 'Проверить'}
                </button>
              )}
            </div>
          ))}

          {act.items.length === 0 && (
            <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
              В акте нет пунктов
            </div>
          )}
        </div>

        <ErrorBox error={toggle.error} />
      </div>
    </>
  );
}
