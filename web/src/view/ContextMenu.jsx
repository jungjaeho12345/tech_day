// Reusable right-click context menu (news.md 기사 조회페이지). Renders a fixed-position list of items
// at the cursor; closes on outside click, Escape, or after an item action. Each item is either an
// enabled action button or a disabled "(준비중)" placeholder — non-functional features are shown but
// disabled rather than faked (explicit product decision).
import { useEffect, useRef } from 'react';

/**
 * @typedef {object} ContextMenuItem
 * @property {string} label   visible item label
 * @property {() => void} [onSelect] action handler (omitted/undefined => disabled)
 * @property {boolean} [disabled] force-disable (non-functional placeholder)
 */

/**
 * @param {{
 *   x: number, y: number,
 *   items: ContextMenuItem[],
 *   onClose: () => void,
 * }} props
 */
export function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  // Close on outside click and on Escape. Capture-phase pointer so a click that lands on the menu
  // itself is handled by the item button (which then closes via its own onSelect path).
  useEffect(() => {
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <ul
      ref={ref}
      role="menu"
      aria-label="기사 메뉴"
      className="yh-ctxmenu"
      style={{ top: y, left: x }}
    >
      {items.map((item) => {
        const disabled = item.disabled || typeof item.onSelect !== 'function';
        return (
          <li key={item.label} role="none" className="yh-ctxmenu__row">
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              className={`yh-ctxmenu__item${disabled ? ' yh-ctxmenu__item--disabled' : ''}`}
              onClick={() => {
                if (disabled) return;
                item.onSelect();
                onClose();
              }}
            >
              <span className="yh-ctxmenu__label">{item.label}</span>
              {disabled ? <span className="yh-ctxmenu__hint">(준비중)</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
