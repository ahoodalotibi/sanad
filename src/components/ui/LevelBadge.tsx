import type { ContentLevel } from '../../types';
import { useI18n } from '../../i18n/I18nProvider';
import { cx } from '../../lib/cx';

const TONE: Record<ContentLevel, string> = {
  A: 'border-matcha/35 text-matcha-ink',
  B: 'border-pistache text-matcha-ink',
  C: 'border-chai text-carob-ink',
  D: 'border-carob/50 text-carob-ink',
};

/** Content level (A–D from the reference standard), with its meaning in the tooltip. */
export function LevelBadge({ level, className }: { level: ContentLevel; className?: string }) {
  const { t } = useI18n();
  const info = t.levels[level];
  return (
    <span
      className={cx('ui-text inline-flex items-center gap-1.5 rounded-full border bg-paper px-2.5 py-0.5 text-[0.78rem] font-medium', TONE[level], className)}
      title={`${info.name}: ${info.handling}`}
    >
      <span className="font-display text-[0.95rem] leading-none" lang="en">{level}</span>
      <span>{info.name}</span>
    </span>
  );
}
