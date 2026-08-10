import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Стек открытых окон.
 *
 * Окна бывают вложенными: из формы позиции открывается выбор иконки.
 * Оба слушателя Escape висят на document, а stopPropagation не отменяет
 * обработчики на том же элементе — без стека одно нажатие закрывало бы
 * сразу оба окна, и пользователь терял заполненную форму. Реагирует
 * только верхнее.
 */
const openModals: symbol[] = [];

/**
 * Модальное окно.
 *
 * Три вещи, без которых модалка только выглядит модалкой:
 *  • фокус уходит внутрь и не убегает наружу по Tab — иначе с клавиатуры
 *    можно «провалиться» в форму под затемнением;
 *  • Escape закрывает — и только верхнее окно;
 *  • фон под ней не прокручивается.
 * Рендерим порталом в body: внутри .shell стоит overflow: hidden, и модалка
 * обрезалась бы по краю карточки.
 */
export function Modal({
  title,
  children,
  onClose,
  width = 560,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const token = Symbol('modal');
    openModals.push(token);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));

    // Первое поле формы важнее заголовка: пользователь открыл модалку,
    // чтобы что-то ввести.
    const first = focusable()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // Клавиши обрабатывает только верхнее окно стека.
      if (openModals[openModals.length - 1] !== token) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return;

      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;

      // Замыкаем обход в кольцо внутри панели.
      if (event.shiftKey && active === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && active === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const index = openModals.indexOf(token);
      if (index !== -1) openModals.splice(index, 1);
      // Прокрутку возвращаем только когда закрылось последнее окно: иначе
      // закрытие вложенного вернуло бы прокрутку фону под ещё открытым.
      if (openModals.length === 0) document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className="modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Клик по самой панели не должен закрывать окно — только по фону.
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
