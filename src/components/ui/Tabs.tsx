import { useId, useRef, type KeyboardEvent } from 'react';
import { cx } from '../../lib/cx';

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; count?: number }[];
  label: string;
}

/** Underline tabs with arrow-key navigation (direction-aware). */
export function Tabs<T extends string>({ value, onChange, items, label }: TabsProps<T>) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    const forward = (e.key === 'ArrowRight') !== rtl;
    const index = items.findIndex((i) => i.value === value);
    const next = items[(index + (forward ? 1 : -1) + items.length) % items.length];
    onChange(next.value);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className="mb-5 flex gap-6 border-b border-almond">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${id}-${item.value}`}
            data-value={item.value}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cx(
              'ui-text relative -mb-px flex items-center gap-2 border-b-2 pb-3 text-[0.95rem] font-medium transition-colors',
              active ? 'border-forest text-forest' : 'border-transparent text-matcha-ink hover:text-forest'
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="rounded-full bg-almond px-1.5 text-xs text-matcha-ink" lang="en">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
