import { Inject, Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import type { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import type { AppEnv } from '../config/env.js';
import { ENV } from '../config/env.token.js';

/**
 * Где искать браузер, если CHROMIUM_PATH не задан.
 * Используем уже установленный Chrome/Edge вместо puppeteer с собственным
 * Chromium: 200 МБ на каждую сборку ради печати сметы — плохая сделка.
 */
const CANDIDATES: Record<string, string[]> = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  linux: [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
};

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  constructor(@Inject(ENV) private readonly env: AppEnv) {}

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
  }

  private resolveExecutable(): string {
    if (this.env.CHROMIUM_PATH) {
      if (!existsSync(this.env.CHROMIUM_PATH)) {
        throw new ServiceUnavailableException(
          `Браузер по пути CHROMIUM_PATH не найден: ${this.env.CHROMIUM_PATH}`,
        );
      }
      return this.env.CHROMIUM_PATH;
    }

    const found = (CANDIDATES[process.platform] ?? []).find((path) => existsSync(path));
    if (!found) {
      throw new ServiceUnavailableException(
        'Не найден Chrome или Chromium для генерации PDF. ' +
          'Установите браузер или укажите путь в переменной CHROMIUM_PATH. ' +
          'Экспорт в Word при этом работает и без браузера.',
      );
    }
    return found;
  }

  /**
   * Браузер запускается один раз и живёт до остановки сервиса: старт Chrome
   * занимает секунды, и делать это на каждую печать сметы незачем.
   * launching защищает от гонки, когда два запроса пришли одновременно.
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = puppeteer
      .launch({
        executablePath: this.resolveExecutable(),
        headless: true,
        // --no-sandbox обязателен в контейнере: процесс идёт под root, а
        // Chromium под root со включённой песочницей запускаться отказывается.
        // Риск приемлем — страница печатается с выключенным JS и заблокированной
        // сетью (см. render), то есть недоверенному коду негде исполниться.
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
      })
      .then((browser) => {
        this.browser = browser;
        this.launching = null;
        this.logger.log('Браузер для печати PDF запущен');
        return browser;
      })
      .catch((error) => {
        this.launching = null;
        throw error;
      });

    return this.launching;
  }

  /**
   * HTML → PDF.
   *
   * Страница изолирована настолько, насколько возможно: JavaScript выключен,
   * любые сетевые запросы блокируются. Разметку мы генерируем сами и всё в ней
   * экранируем, но печать — это исполнение недоверенных данных в браузере,
   * и полагаться на одно только экранирование не стоит.
   */
  async render(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setJavaScriptEnabled(false);

      await page.setRequestInterception(true);
      page.on('request', (request) => {
        // Пропускаем только сам документ. Никаких внешних шрифтов, картинок
        // и тем более обращений к внутренней сети сервера.
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
          void request.continue();
        } else {
          void request.abort();
        }
      });

      await page.setContent(html, { waitUntil: 'load', timeout: 15_000 });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 20_000,
      });

      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
