import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth.js';
import { Field, TextInput } from '../ui.js';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await login(email.trim(), password);
    } catch (cause) {
      // Показываем ровно то, что ответил сервер. Он намеренно не различает
      // «нет такого пользователя» и «неверный пароль», чтобы по форме входа
      // нельзя было перебрать список зарегистрированных адресов.
      setError(cause instanceof ApiError ? cause.message : 'Не удалось войти. Проверьте соединение.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 20 }}>
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--surface)',
          borderRadius: 22,
          boxShadow: '0 24px 60px rgba(46,49,42,0.10), 0 2px 6px rgba(46,49,42,0.06)',
          padding: 28,
        }}
      >
        <div className="brand" style={{ padding: 0, marginBottom: 22 }}>
          <img src="/logo.png" alt="Яспектр" />
          <div>
            <div className="brand-name">Яспектр</div>
            <div className="brand-sub">системы безопасности</div>
          </div>
        </div>

        <div className="stack">
          <Field label="Email">
            <TextInput
              type="email"
              name="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Пароль">
            <TextInput
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && <div className="alert">{error}</div>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </div>
      </form>
    </div>
  );
}
