import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '@yaspectr/core';
import { useAuth } from './auth.js';
import { ActScreen } from './screens/Act.js';
import { ActsScreen } from './screens/Acts.js';
import { CatalogScreen } from './screens/Catalog.js';
import { EstimateScreen } from './screens/Estimate.js';
import { EstimatesScreen } from './screens/Estimates.js';
import { KitsScreen } from './screens/Kits.js';
import { LoginScreen } from './screens/Login.js';
import { SettingsScreen } from './screens/Settings.js';
import {
  IconArrowLeft,
  IconBolt,
  IconChevronDown,
  IconCloud,
  IconDoc,
  IconDocCheck,
  IconGear,
  IconGrid,
  IconMenu,
  IconTable,
  Spinner,
} from './ui.js';

/**
 * Оболочка ровно как в макете: белая карточка со скруглением 22px и тенью,
 * по центру на фоне #EAEDE2, внутри — сайдбар 236px и рабочая область.
 * На телефоне карточка разворачивается во весь экран, а сайдбар становится
 * выдвижной панелью по кнопке-гамбургеру (мобильный макет).
 */
export function App() {
  const { user, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
        <Spinner label="Загрузка…" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="page">
      <div className="shell">
        {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

        <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />

        <div className="main">
          <MobileBar
            title={titleFor(location.pathname)}
            backTo={parentListFor(location.pathname)}
            onMenu={() => setDrawerOpen(true)}
          />

          <Routes>
            <Route path="/" element={<Navigate to="/estimates" replace />} />
            <Route path="/estimates" element={<EstimatesScreen />} />
            <Route path="/estimates/:id" element={<EstimateScreen />} />
            <Route path="/acts" element={<ActsScreen />} />
            <Route path="/acts/:id" element={<ActScreen />} />
            <Route path="/catalog" element={<CatalogScreen />} />
            <Route path="/kits" element={<KitsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/estimates" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

/**
 * Разделы ровно теми названиями и значками, что в макете.
 *
 * Первые два — это два вида одного и того же расчёта, поэтому они не
 * отдельные страницы, а переключатель вкладки открытой сметы (`view`).
 * Отсюда и собственная проверка активности: NavLink сравнивает только путь
 * и параметр запроса игнорирует, из-за чего подсвечивались бы оба пункта
 * сразу.
 */
const VIEW_ITEMS = [
  { view: 'express', label: 'Экспресс-расчёт', Icon: IconBolt },
  { view: 'detailed', label: 'Детальная смета', Icon: IconDoc },
] as const;

const ROUTE_ITEMS = [
  { to: '/acts', label: 'Акты работ', Icon: IconDocCheck, group: 1 },
  { to: '/catalog', label: 'База позиций', Icon: IconTable, group: 2 },
  { to: '/kits', label: 'Шаблоны комплектов', Icon: IconGrid, group: 2 },
  { to: '/settings', label: 'Настройки', Icon: IconGear, group: 2 },
];

function titleFor(pathname: string): string {
  if (pathname.startsWith('/acts')) return 'Акты работ';
  if (pathname.startsWith('/catalog')) return 'База позиций';
  if (pathname.startsWith('/kits')) return 'Шаблоны комплектов';
  if (pathname.startsWith('/settings')) return 'Настройки';
  return 'Экспресс-расчёт';
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  if (!user) return null;

  const onEstimates = location.pathname.startsWith('/estimates');
  const currentView = new URLSearchParams(location.search).get('view') ?? 'express';

  const routeItem = ({ to, label, Icon }: (typeof ROUTE_ITEMS)[number]) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );

  const viewItem = ({ view, label, Icon }: (typeof VIEW_ITEMS)[number]) => (
    <button
      key={view}
      type="button"
      className={`nav-item${onEstimates && currentView === view ? ' active' : ''}`}
      onClick={() => {
        onNavigate();
        // Если смета открыта — переключаем её вкладку, не выкидывая
        // пользователя обратно в список.
        const isSingle = /^\/estimates\/[^/]+$/.test(location.pathname);
        const target = isSingle ? location.pathname : '/estimates';
        navigate(view === 'express' ? target : `${target}?view=${view}`);
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <img src="/logo.png" alt="Яспектр" />
        <div>
          <div className="brand-name">Яспектр</div>
          <div className="brand-sub">системы безопасности</div>
        </div>
      </div>

      <div className="nav-group">
        {VIEW_ITEMS.map(viewItem)}
        {ROUTE_ITEMS.filter((i) => i.group === 1).map(routeItem)}
      </div>

      <div className="nav-divider" />

      <div className="nav-group">{ROUTE_ITEMS.filter((i) => i.group === 2).map(routeItem)}</div>

      <div className="sidebar-spacer" />

      <div className="sync-card">
        <IconCloud />
        <div>
          <div className="sync-title">Синхронизация</div>
          {/* В макете стояло «Обновлено 2 мин назад». Показывать выдуманное
              время нечестно: данные тянутся с сервера при каждом открытии,
              офлайн-очереди нет. Пишем то, что есть на самом деле. */}
          <div className="sync-time">Данные с сервера</div>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <button type="button" className="user-row" onClick={() => setMenuOpen(!menuOpen)}>
          <div className="avatar">{initials(user.fullName)}</div>
          <div className="grow">
            <div className="user-name">{shortName(user.fullName)}</div>
            <div className="user-role">{ROLE_LABELS[user.role]}</div>
          </div>
          <IconChevronDown />
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(46,49,42,0.12)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              className="nav-item"
              style={{ borderRadius: 0 }}
              onClick={() => void logout()}
            >
              Выйти
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Список, в который возвращает страница документа. На экране сметы или акта
 * гамбургер уступает место стрелке назад: на телефоне это привычнее, чем
 * искать выход в выдвижном меню.
 */
function parentListFor(pathname: string): string | null {
  if (/^\/estimates\/[^/]+$/.test(pathname)) return '/estimates';
  if (/^\/acts\/[^/]+$/.test(pathname)) return '/acts';
  return null;
}

function MobileBar({
  title,
  backTo,
  onMenu,
}: {
  title: string;
  backTo: string | null;
  onMenu: () => void;
}) {
  return (
    <div className="mobile-bar">
      {backTo ? (
        <Link to={backTo} aria-label="Назад к списку">
          <IconArrowLeft size={22} />
        </Link>
      ) : (
        <button type="button" onClick={onMenu} aria-label="Меню">
          <IconMenu />
        </button>
      )}
      <div className="title">
        <img src="/logo.png" alt="" />
        {title}
      </div>
      {/* Уравновешивает шапку: без пустого блока заголовок съезжает влево. */}
      <div style={{ width: 22 }} />
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** «Алексей Петров» → «Алексей П.» — как в макете. */
function shortName(fullName: string): string {
  const [first, second] = fullName.split(/\s+/).filter(Boolean);
  if (!first) return fullName;
  return second ? `${first} ${second[0]}.` : first;
}
