/**
 * Клиент API.
 *
 * Сессия живёт в httpOnly-cookie, которую скрипт прочитать не может, — это и
 * есть защита от кражи сессии при XSS. Единственное, что фронт достаёт из
 * cookie, это CSRF-токен: он специально сделан читаемым, чтобы продублировать
 * его в заголовке. Сервер сверяет одно с другим (double submit).
 */

const CSRF_COOKIE = 'ya_csrf';
const CSRF_HEADER = 'X-CSRF-Token';

/** Методы, которые сервер пропускает без CSRF-заголовка. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Ошибки по полям от Zod-схемы: { 'clientPhone': 'некорректный телефон' }. */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

function readCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfToken();
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    // Без credentials cookie-сессия не поедет вовсе.
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    let fields: Record<string, string> | undefined;

    try {
      const payload = await response.json();
      if (typeof payload?.message === 'string') message = payload.message;
      if (payload?.errors && typeof payload.errors === 'object') fields = payload.errors;
    } catch {
      // Ответ без JSON — оставляем сообщение по статусу.
    }

    throw new ApiError(response.status, message, fields);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/**
 * Скачивание документа.
 *
 * Через fetch, а не через <a href>, чтобы ошибка (нет прав, не найдено,
 * не установлен Chrome для PDF) пришла как обычная ApiError и её можно было
 * показать. Прямая ссылка в таком случае открыла бы вкладку с JSON-ошибкой.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' });

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    try {
      message = (await response.json())?.message ?? message;
    } catch {
      /* оставляем сообщение по статусу */
    }
    throw new ApiError(response.status, message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFromDisposition(response.headers.get('Content-Disposition')) ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Освобождаем память: без revoke blob висит до перезагрузки страницы.
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  // filename* (RFC 5987) содержит кириллицу в процентной кодировке —
  // предпочитаем его обычному filename, который у нас транслитерирован.
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* повреждённый заголовок — упадём на обычный filename */
    }
  }

  return header.match(/filename="([^"]+)"/i)?.[1] ?? null;
}
