import { useState, type FormEvent } from 'react';
import { ROLES, ROLE_LABELS } from '@yaspectr/core';
import type { Role } from '@yaspectr/core';
import {
  useCreateUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from '../api/hooks.js';
import type { CompanyUser } from '../api/types.js';
import { useAuth } from '../auth.js';
import { Modal } from '../modal.js';
import { Empty, ErrorBox, Field, IconPlus, Spinner, TextInput } from '../ui.js';

export function SettingsScreen() {
  const { user, can, logout } = useAuth();
  const canManageUsers = can('user:write');
  const { data: users, isLoading, error } = useUsers(can('user:read'));

  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<CompanyUser | null>(null);

  return (
    <>
      <div className="page-head">
        <div className="grow">
          <h1 className="page-title">Настройки</h1>
          <div className="page-sub">Учётная запись и сотрудники компании</div>
        </div>
        {canManageUsers && (
          <button type="button" className="btn-outline" onClick={() => setCreating(true)}>
            <IconPlus />
            Добавить сотрудника
          </button>
        )}
      </div>

      <div className="calc-grid" style={{ marginTop: 26 }}>
        <div className="calc-main stack">
          <div className="card">
            <h2 className="section-title" style={{ flex: 'none', fontSize: 17, marginBottom: 14 }}>
              Учётная запись
            </h2>
            <div className="totals-row" style={{ marginBottom: 10 }}>
              <span className="label">Имя</span>
              <span className="value">{user?.fullName}</span>
            </div>
            <div className="totals-row" style={{ marginBottom: 10 }}>
              <span className="label">Email</span>
              <span className="value">{user?.email}</span>
            </div>
            <div className="totals-row" style={{ marginBottom: 16 }}>
              <span className="label">Роль</span>
              <span className="value">{user ? ROLE_LABELS[user.role] : ''}</span>
            </div>
            <button type="button" className="btn-outline" onClick={() => void logout()}>
              Выйти
            </button>
          </div>

          {can('user:read') && (
            <div className="card" style={{ padding: 0 }}>
              <h2
                className="section-title"
                style={{ flex: 'none', padding: '18px 18px 12px', fontSize: 17 }}
              >
                Сотрудники
              </h2>

              <ErrorBox error={error} />
              {isLoading && <Spinner label="Загрузка…" />}

              {users?.map((member) => (
                <UserRow
                  key={member.id}
                  member={member}
                  isSelf={member.id === user?.id}
                  canManage={canManageUsers}
                  onReset={() => setResetting(member)}
                />
              ))}

              {users?.length === 0 && (
                <div className="muted" style={{ padding: 18 }}>
                  Сотрудников пока нет
                </div>
              )}
            </div>
          )}

          {!can('user:read') && (
            <Empty
              title="Управление сотрудниками недоступно"
              hint="Список сотрудников виден администратору компании."
            />
          )}
        </div>

        <div />
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {resetting && (
        <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
      )}
    </>
  );
}

function UserRow({
  member,
  isSelf,
  canManage,
  onReset,
}: {
  member: CompanyUser;
  isSelf: boolean;
  canManage: boolean;
  onReset: () => void;
}) {
  const update = useUpdateUser();

  return (
    <div
      className="row"
      style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}
    >
      <div className="grow" style={{ opacity: member.isActive ? 1 : 0.5 }}>
        <div style={{ fontWeight: 500 }}>
          {member.fullName}
          {isSelf && (
            <span className="faint" style={{ fontSize: 12, marginLeft: 8 }}>
              это вы
            </span>
          )}
        </div>
        <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
          {member.email}
          {!member.isActive && ' · отключён'}
        </div>
      </div>

      {canManage && !isSelf ? (
        <>
          {/* Роль меняется прямо в списке: это самое частое действие, ради
              него не стоит открывать отдельное окно. */}
          <select
            className="select-sm"
            value={member.role}
            disabled={update.isPending}
            onChange={(e) => void update.mutateAsync({ id: member.id, role: e.target.value as Role })}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

          <button type="button" className="btn-outline" onClick={onReset}>
            Сбросить пароль
          </button>

          <button
            type="button"
            className="btn-outline"
            style={member.isActive ? { color: 'var(--danger)' } : undefined}
            disabled={update.isPending}
            title={
              member.isActive
                ? 'Сотрудник потеряет доступ немедленно, все его сеансы закроются'
                : 'Вернуть доступ'
            }
            onClick={() =>
              void update.mutateAsync({ id: member.id, isActive: !member.isActive })
            }
          >
            {member.isActive ? 'Отключить' : 'Включить'}
          </button>
        </>
      ) : (
        <span className={`badge${member.isActive ? '' : ' badge-muted'}`}>
          {ROLE_LABELS[member.role]}
        </span>
      )}

      {update.error && (
        <div className="alert" style={{ width: '100%' }}>
          {update.error instanceof Error ? update.error.message : 'Не удалось изменить'}
        </div>
      )}
    </div>
  );
}

/**
 * Генератор пароля.
 *
 * Пароль придумывает система, а не администратор: иначе на всю компанию
 * заводится один «Montazh2026» и меняется он никогда. Берём crypto, а не
 * Math.random — он не предназначен для секретов.
 */
function generatePassword(length = 16): string {
  // Без похожих символов (0/O, 1/l/I): пароль часто диктуют голосом.
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const create = useCreateUser();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'INSTALLER' as Role,
    password: generatePassword(),
  });
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      password: form.password,
    });
    // Пароль показываем ПОСЛЕ создания и только здесь: сервер хранит лишь
    // argon2id-хеш и повторно этот пароль показать неоткуда.
    setCreated({ email: form.email.trim(), password: form.password });
  }

  const fieldError = (name: string) =>
    create.error && 'fields' in create.error
      ? (create.error as { fields?: Record<string, string> }).fields?.[name]
      : undefined;

  if (created) {
    return (
      <Modal title="Сотрудник добавлен" onClose={onClose}>
        <div className="notice">
          Передайте эти данные сотруднику. Пароль показывается один раз — сервер хранит
          только его хеш и восстановить пароль не сможет.
        </div>

        <div className="card stack" style={{ gap: 10 }}>
          <div className="totals-row">
            <span className="label">Email</span>
            <span className="value">{created.email}</span>
          </div>
          <div className="totals-row">
            <span className="label">Пароль</span>
            <code style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' }}>
              {created.password}
            </code>
          </div>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              void navigator.clipboard.writeText(
                `Вход в Яспектр\nЛогин: ${created.email}\nПароль: ${created.password}`,
              )
            }
          >
            Скопировать
          </button>
          <button type="button" className="head-chip" onClick={onClose}>
            Готово
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Новый сотрудник" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Имя" error={fieldError('fullName')}>
          <TextInput
            required
            placeholder="Алексей Петров"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </Field>

        <Field label="Email" error={fieldError('email')}>
          <TextInput
            type="email"
            required
            placeholder="montazhnik@company.ru"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>

        <div className="form-row">
          <Field label="Роль">
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Телефон" error={fieldError('phone')}>
            <TextInput
              placeholder="+7 900 123-45-67"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Пароль" error={fieldError('password')}>
          <div className="row" style={{ gap: 8 }}>
            <TextInput
              required
              minLength={12}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              className="head-chip nowrap"
              onClick={() => setForm({ ...form, password: generatePassword() })}
            >
              Сгенерировать
            </button>
          </div>
        </Field>

        <div className="faint" style={{ fontSize: 12 }}>
          {ROLE_HINTS[form.role]}
        </div>

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

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Полный доступ: справочник, комплекты, сметы, сотрудники, закупочные цены.',
  MANAGER: 'Сметы и акты, видит закупочные цены. Справочник и сотрудников не правит.',
  INSTALLER: 'Только свои акты. Смету видит, править не может. Закупочные цены не видит.',
};

function ResetPasswordModal({
  member,
  onClose,
}: {
  member: CompanyUser;
  onClose: () => void;
}) {
  const reset = useResetUserPassword();
  const [password, setPassword] = useState(() => generatePassword());
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await reset.mutateAsync({ id: member.id, newPassword: password });
    setDone(true);
  }

  return (
    <Modal title={`Пароль: ${member.fullName}`} onClose={onClose}>
      {done ? (
        <>
          <div className="notice">
            Пароль изменён, все сеансы сотрудника закрыты. Передайте новый пароль —
            показывается он один раз.
          </div>
          <div className="card">
            <div className="totals-row">
              <span className="label">{member.email}</span>
              <code style={{ fontSize: 15, fontWeight: 600 }}>{password}</code>
            </div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                void navigator.clipboard.writeText(
                  `Вход в Яспектр\nЛогин: ${member.email}\nПароль: ${password}`,
                )
              }
            >
              Скопировать
            </button>
            <button type="button" className="head-chip" onClick={onClose}>
              Готово
            </button>
          </div>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <Field label="Новый пароль">
            <div className="row" style={{ gap: 8 }}>
              <TextInput
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="head-chip nowrap"
                onClick={() => setPassword(generatePassword())}
              >
                Сгенерировать
              </button>
            </div>
          </Field>

          <div className="faint" style={{ fontSize: 12 }}>
            Смена пароля закроет все активные сеансы сотрудника.
          </div>

          <ErrorBox error={reset.error} />

          <div className="row" style={{ marginTop: 4 }}>
            <button type="submit" className="btn-primary" disabled={reset.isPending}>
              {reset.isPending ? 'Сохранение…' : 'Сменить пароль'}
            </button>
            <button type="button" className="head-chip" onClick={onClose}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
