import { ITEM_KIND_LABELS, UNIT_LABELS, formatMoney, formatQty } from '@yaspectr/core';
import { useKits } from '../api/hooks.js';
import { Empty, ErrorBox, Spinner, iconForItem } from '../ui.js';

/**
 * Шаблоны комплектов — то самое «если монтаж камеры, то сразу юстировка
 * + распред. коробка». Экран показывает, что именно развернётся при
 * добавлении базовой позиции в смету.
 */
export function KitsScreen() {
  const { data, isLoading, error } = useKits();

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">Шаблоны комплектов</h1>
          <div className="page-sub">
            Добавляя базовую позицию в смету, вы получаете весь комплект целиком.
          </div>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 22 }}>
        <ErrorBox error={error} />
        {isLoading && <Spinner label="Загрузка комплектов…" />}

        {data && data.length === 0 && (
          <Empty title="Комплектов пока нет" hint="Их можно создать через API либо загрузить сидом." />
        )}

        {data?.map((kit) => (
          <div key={kit.id} className="position">
            <div className="position-head">
              <div className="position-icon">{iconForItem(kit.rootItem.name, kit.rootItem.kind)}</div>
              <div className="grow">
                <div className="position-name">{kit.name}</div>
                <div className="position-sub">Базовая позиция: {kit.rootItem.name}</div>
              </div>
              {kit.isDefault && <span className="badge">по умолчанию</span>}
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
                      <td>{kitLine.item.name}</td>
                      <td className="muted">{ITEM_KIND_LABELS[kitLine.item.kind]}</td>
                      <td className="right">
                        {formatQty(kitLine.qtyPerRoot, UNIT_LABELS[kitLine.item.unit])}
                        <span className="faint">
                          {kitLine.qtyMode === 'PER_ROOT' ? ' на позицию' : ' на объект'}
                        </span>
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
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
