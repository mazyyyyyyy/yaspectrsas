import { useMemo, useState } from 'react';
import {
  CATALOG_ICONS,
  ICON_GROUPS,
  ICON_GROUP_LABELS,
  findIcon,
  type IconGroup,
} from '@yaspectr/core';
import { CatalogIcon } from './catalog-icons.js';
import { Modal } from './modal.js';

/**
 * Поле выбора иконки: показывает текущую и открывает каталог по нажатию.
 * Раньше значок выводился из названия позиции — пользователь не мог ни
 * понять, откуда он взялся, ни поменять его.
 */
export function IconField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = findIcon(value);

  return (
    <div className="field">
      <span className="field-label">Иконка</span>

      <button type="button" className="icon-field" onClick={() => setOpen(true)}>
        <span className="icon-field-preview">
          <CatalogIcon id={value} size={20} />
        </span>
        <span className="grow" style={{ textAlign: 'left' }}>
          {meta ? meta.label : 'Выбрать иконку'}
        </span>
        <span className="faint" style={{ fontSize: 12 }}>
          изменить
        </span>
      </button>

      {open && (
        <IconPickerModal
          value={value}
          onPick={(icon) => {
            onChange(icon);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function IconPickerModal({
  value,
  onPick,
  onClose,
}: {
  value: string | null;
  onPick: (icon: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = CATALOG_ICONS.filter((icon) => {
      if (!query) return true;
      // Ищем и по подписи, и по ключевым словам: монтажник напишет
      // «геркон», а в подписи стоит «Магнитоконтактный датчик».
      return (
        icon.label.toLowerCase().includes(query) ||
        icon.keywords.some((word) => word.includes(query))
      );
    });

    return ICON_GROUPS.map((group) => ({
      group,
      items: matches.filter((icon) => icon.group === group),
    })).filter((entry) => entry.items.length > 0);
  }, [search]);

  return (
    <Modal title="Выбор иконки" onClose={onClose} width={640}>
      <input
        className="input"
        placeholder="Поиск: камера, геркон, шлагбаум…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="icon-grid-wrap">
        {groups.map(({ group, items }) => (
          <IconGroupBlock
            key={group}
            group={group}
            items={items}
            value={value}
            onPick={onPick}
          />
        ))}

        {groups.length === 0 && (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
            Ничего не найдено
          </div>
        )}
      </div>
    </Modal>
  );
}

function IconGroupBlock({
  group,
  items,
  value,
  onPick,
}: {
  group: IconGroup;
  items: readonly { id: string; label: string }[];
  value: string | null;
  onPick: (icon: string) => void;
}) {
  return (
    <div>
      <div className="icon-group-title">{ICON_GROUP_LABELS[group]}</div>
      <div className="icon-grid">
        {items.map((icon) => (
          <button
            key={icon.id}
            type="button"
            className={`icon-cell${value === icon.id ? ' selected' : ''}`}
            onClick={() => onPick(icon.id)}
            title={icon.label}
          >
            <CatalogIcon id={icon.id} size={24} />
            <span className="icon-cell-label">{icon.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
