import { useI18n } from '../../i18n/I18nProvider';
import type { Route } from '../../lib/useHashRoute';
import { LogoMark } from '../ui/Brand';

export function SiteFooter({ onNavigate, onOpenStandards }: { onNavigate: (r: Route) => void; onOpenStandards: () => void }) {
  const { t } = useI18n();
  return (
    <footer className="bg-forest text-vanilla">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark size={40} className="text-chai" />
            <div>
              <p className="font-display text-2xl leading-none">{t.brand.name}</p>
              <p lang="ar" dir="rtl" className="mt-1.5 text-sm text-oat">
                {t.brand.sloganAr}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-md text-[0.95rem] text-vanilla/85">{t.footer.disclosure}</p>
          <p className="mt-3 max-w-md text-sm text-vanilla/65">{t.footer.privacy}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col items-start gap-3 md:items-end">
          <button type="button" onClick={() => onNavigate('ask')} className="ui-text text-vanilla/90 hover:text-chai">
            {t.nav.ask}
          </button>
          <button type="button" onClick={onOpenStandards} className="ui-text text-vanilla/90 hover:text-chai">
            {t.nav.standards}
          </button>
          <button type="button" onClick={() => onNavigate('home')} className="ui-text text-vanilla/90 hover:text-chai">
            {t.nav.home}
          </button>
        </nav>
      </div>
      <div className="border-t border-vanilla/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-vanilla/55 sm:px-6">{t.footer.builtFor}</p>
      </div>
    </footer>
  );
}
