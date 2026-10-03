import { useI18n } from '../../i18n/I18nProvider';
import { LANGUAGES } from '../../i18n/languages';
import { cx } from '../../lib/cx';

/**
 * Segmented language control. Each option is rendered in its own script and font
 * (lang attribute), and choosing Urdu flips the whole layout to RTL.
 */
export function LanguageSwitcher({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t.nav.language} className={cx('inline-flex items-center rounded-full border border-oat bg-paper p-1', className)}>
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l.code}
            dir={l.dir}
            onClick={() => setLang(l.code)}
            title={l.englishName}
            className={cx(
              'rounded-full font-medium transition-colors duration-200',
              size === 'md' ? 'h-9 px-3.5' : 'h-8 px-2.5',
              // Nastaliq reads smaller at the same size, so Urdu gets a larger size and tighter leading
              l.code === 'ur'
                ? size === 'md' ? 'text-[1.02rem] leading-[1.6]' : 'text-[0.98rem] leading-[1.6]'
                : size === 'md' ? 'text-[0.9rem]' : 'text-[0.82rem]',
              active ? 'bg-forest text-vanilla' : 'text-matcha-ink hover:bg-almond hover:text-forest'
            )}
          >
            {l.nativeName}
          </button>
        );
      })}
    </div>
  );
}
