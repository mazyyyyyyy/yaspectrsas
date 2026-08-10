import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { can, type Permission } from '@yaspectr/core';
import { ApiError, api } from './api/client.js';
import type { AuthResponse, CurrentUser } from './api/types.js';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Проверка права для показа элементов интерфейса.
   *
   * Это ТОЛЬКО удобство: прятать кнопку, которой всё равно нельзя
   * воспользоваться. Настоящая проверка — на сервере, в RolesGuard, по той же
   * таблице прав из @yaspectr/core. Спрятанная кнопка защитой не является.
   */
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // При загрузке спрашиваем сервер, кто мы: сессия лежит в httpOnly-cookie,
  // прочитать её скриптом нельзя, поэтому восстановить сеанс можно только так.
  useEffect(() => {
    let cancelled = false;

    api
      .get<AuthResponse>('/auth/me')
      .then((response) => {
        if (!cancelled) setUser(response.user);
      })
      .catch((error: unknown) => {
        // 401 — это «не вошёл», нормальное состояние, а не сбой.
        if (!(error instanceof ApiError && error.isUnauthorized)) console.error(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    // Полная перезагрузка: проще и надёжнее, чем вычищать кеш запросов от
    // данных прежнего пользователя вручную.
    window.location.href = '/';
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      can: (permission) => (user ? can(user.role, permission) : false),
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth вызван вне AuthProvider');
  return context;
}
