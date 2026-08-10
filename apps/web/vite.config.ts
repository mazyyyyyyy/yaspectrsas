import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Яспектр — сметы и акты',
        short_name: 'Яспектр',
        description: 'Расчёт смет и акты выполненных работ для монтажа систем безопасности',
        lang: 'ru',
        start_url: '/',
        display: 'standalone',
        background_color: '#EAEDE2',
        theme_color: '#8AB50F',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Отдельный файл, а не тот же самый: систему maskable-иконку
          // обрезает под свою форму (круг на Android, сквиркл на iOS), и знак
          // без запаса по краям срезается. У этого варианта поле шире.
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Кешируем только собственную оболочку приложения. Ответы API сюда
        // не попадают сознательно: цены и сметы должны быть свежими, а
        // устаревший прайс в кеше — это счёт клиенту по прошлогодним ценам.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // В разработке фронт и API живут на разных портах. Проксируем, чтобы
      // браузер считал их одним источником и cookie-сессия работала без
      // послаблений в CORS.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
