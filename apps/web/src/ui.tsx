/**
 * Иконки и мелкие элементы.
 *
 * SVG-пути скопированы из макета SecuCalc.dc.html дословно, вместе с
 * толщинами обводки (1.7 / 1.8 / 1.9 / 2 / 2.2 / 2.4) — они там разные
 * у разных значков, и «унификация» заметно меняет вид.
 */

import type { InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { UNIT_LABELS, formatMoney, formatQty } from '@yaspectr/core';
import type { ItemKind, Kopecks, QtyMilli, Unit } from '@yaspectr/core';

interface IconProps {
  size?: number;
}

const line = (width: number) => ({
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const svg = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
});

export const IconBolt = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(2)}>
    <path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z" />
  </svg>
);

export const IconDoc = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(1.8)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

export const IconDocCheck = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(1.8)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);

export const IconActTab = ({ size = 17 }: IconProps) => (
  <svg {...svg(size)} {...line(1.8)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconTable = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(1.8)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 4v16" />
  </svg>
);

export const IconGrid = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(1.8)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 17.5h7M17.5 14v7" />
  </svg>
);

export const IconGear = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(1.8)}>
    <circle cx="12" cy="12" r="6.6" />
    <circle cx="12" cy="12" r="2.4" />
    <path d="M12 4.6V2.2M12 21.8v-2.4M19.4 12h2.4M2.2 12h2.4M17.23 6.77l1.7-1.7M5.07 18.93l1.7-1.7M17.23 17.23l1.7 1.7M5.07 5.07l1.7 1.7" />
  </svg>
);

export const IconCloud = ({ size = 20 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)} stroke="#969B93">
    <path d="M18 16.5a3.5 3.5 0 0 0-1.2-6.8A5 5 0 0 0 7.2 9 4 4 0 0 0 7 16.5h11z" />
  </svg>
);

export const IconChevronDown = ({ size = 14 }: IconProps) => (
  <svg {...svg(size)} {...line(2)} stroke="#A6ABA2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconChevronRight = ({ size = 14, open = false }: IconProps & { open?: boolean }) => (
  <svg
    {...svg(size)}
    {...line(2.4)}
    stroke="#A6ABA2"
    style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .18s', flex: 'none' }}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconPlus = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(2.2)} stroke="#8AB50F">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheckCircle = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(2)} stroke="#7FA80F">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

export const IconDots = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="#767B73">
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

export const IconMenu = ({ size = 22 }: IconProps) => (
  <svg {...svg(size)} {...line(1.9)} stroke="#4A4E48">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconSave = ({ size = 17 }: IconProps) => (
  <svg {...svg(size)} {...line(1.9)}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v6h7M8 14h8v7H8z" />
  </svg>
);

export const IconPdf = ({ size = 17 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M9 16h6" />
  </svg>
);

export const IconSend = ({ size = 17 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <path d="M21 3L10.5 13.5" />
    <path d="M21 3l-6.5 18-4-8-8-4L21 3z" />
  </svg>
);

export const IconArrowLeft = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(2)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconTrash = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export const IconCheck = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} {...line(3)}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

// ── Значки типов оборудования (для плиток и строк позиций) ──

export const IconCamera = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <path d="M3 9.5l14-4.5 2 5.5-14 4.5z" />
    <circle cx="10" cy="10" r="2" />
    <path d="M8 15v4h8" />
  </svg>
);

export const IconWifi = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(1.9)}>
    <path d="M4 9.5a12 12 0 0 1 16 0" />
    <path d="M7 13a8 8 0 0 1 10 0" />
    <circle cx="12" cy="17.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconDoor = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <circle cx="12" cy="8" r="1.6" />
    <path d="M10 13h4M10 16.5h4" />
  </svg>
);

export const IconNvr = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <rect x="2.5" y="8" width="19" height="8" rx="2" />
    <path d="M6 12h1M9.5 12h1" />
    <circle cx="18" cy="12" r="1" />
  </svg>
);

export const IconBox = ({ size = 15 }: IconProps) => (
  <svg {...svg(size)} {...line(1.7)}>
    <rect x="3.5" y="6" width="17" height="13" rx="2" />
    <path d="M3.5 10h17" />
  </svg>
);

/**
 * Подбор значка по названию позиции.
 *
 * В макете иконка выбиралась по жёстко зашитому ключу (isCam/isWifi/…),
 * потому что там было четыре захардкоженных позиции. В реальном справочнике
 * их сотни и он редактируемый, поэтому смотрим на название, а на всё
 * незнакомое даём нейтральный значок — вместо пустого места.
 */
export function iconForItem(name: string, kind: ItemKind, size = 15) {
  const text = name.toLowerCase();
  if (text.includes('камер')) return <IconCamera size={size} />;
  if (text.includes('wi-fi') || text.includes('wifi') || text.includes('точка доступа'))
    return <IconWifi size={size} />;
  if (text.includes('домофон') || text.includes('вызывн')) return <IconDoor size={size} />;
  if (text.includes('регистратор') || text.includes('nvr')) return <IconNvr size={size} />;
  if (kind === 'CABLE') return <IconBox size={size} />;
  return <IconBox size={size} />;
}

// ── Мелкие элементы ─────────────────────────────────────────

export const Money = ({ value }: { value: Kopecks }) => <>{formatMoney(value)}</>;

export const Qty = ({ value, unit }: { value: QtyMilli; unit: Unit }) => (
  <>{formatQty(value, UNIT_LABELS[unit])}</>
);

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`.trim()} />;
}

/**
 * Возврат к списку со страницы документа.
 *
 * Без него страница сметы — тупик: пункты меню слева переключают вид
 * текущего расчёта, а не уводят в список, и выйти можно было только
 * кнопкой «назад» в браузере.
 */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="back-link">
      <IconArrowLeft />
      {children}
    </Link>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row" style={{ padding: 24, color: 'var(--text-muted)' }}>
      <div className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="alert">{error instanceof Error ? error.message : String(error)}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {hint && (
        <div className="muted" style={{ fontSize: 13 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
