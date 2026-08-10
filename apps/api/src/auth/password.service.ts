import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';

/**
 * Хеширование паролей — argon2id.
 *
 * Не bcrypt (лимит 72 байта и слабое сопротивление GPU) и тем более не
 * SHA-256: быстрая хеш-функция для паролей — это подарок тому, кто утащил дамп.
 *
 * Параметры — минимум из рекомендаций OWASP Password Storage Cheat Sheet:
 * 19 МиБ памяти, 2 прохода, параллелизм 1. Память здесь важнее итераций,
 * именно она делает перебор на видеокартах дорогим.
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * Хеш несуществующего пароля. Нужен, чтобы вход с незнакомым email занимал
 * столько же времени, сколько вход с известным: иначе по времени ответа
 * перебирается список зарегистрированных адресов.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$V0LGKKvOFxQKMTYDMxg6JMLIfLXNlLPuKrGGGjYCcOs';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      // Битый или подменённый хеш — это «не совпало», а не 500.
      return false;
    }
  }

  /** Сжечь то же время, что и на реальной проверке. */
  async fakeVerify(password: string): Promise<void> {
    try {
      await verify(DUMMY_HASH, password);
    } catch {
      // Результат не важен — важна только потраченная работа.
    }
  }
}
