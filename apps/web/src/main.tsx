import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { ApiError } from './api/client.js';
import { AuthProvider } from './auth.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Цены и сметы должны быть свежими: пользователь возвращается на
      // вкладку — данные перечитываются.
      staleTime: 10_000,
      retry: (failureCount, error) => {
        // Повторять запрос, отклонённый по правам или из-за истёкшей сессии,
        // бессмысленно — ответ не изменится.
        if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) return false;
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
