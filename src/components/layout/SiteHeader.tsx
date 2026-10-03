import { BookOpen, Menu, MessageSquarePlus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { cx } from '../../lib/cx';
import type { Route } from '../../lib/useHashRoute';
import { Button, IconButton } from '../ui/Button';
import { Wordmark } from '../ui/Brand';
import { Dialog } from '../ui/Dialog';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

interface SiteHeaderProps {
  route: Route;
  onNavigate: (route: Route) => void;
  onOpenStandards: () => void;
  onOpenRequests: () => void;
  requestCount: number;
  canStartNew: boolean;
  onNewConversation: () => void;
}

export function SiteHeader({ route, onNavigate, onOpenStandards, onOpenRequests, requestCount, canStartNew, onNewConversation }: SiteHeaderProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLink = (target: Route, label: string) => (
    <a
      href={target === 'ask' ? '#/ask' : '#/'}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(target);
      }}
      aria-current={route === target ? 'page' : undefined}
      className={cx(
        'ui-text relative px-1 py-2 text-[0.95rem] transition-colors',
        route === target ? 'text-forest' : 'text-matcha-ink hover:text-forest'
      )}
    >
      {label}
      {route === target && <span className="absolute inset-x-1 -bottom-0.5 h-px bg-matcha" />}
    </a>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-almond/80 bg-vanilla/92 backdrop-blur-md supports-[backdrop-filter]:bg-vanilla/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:rounded-full focus:bg-forest focus:px-4 focus:py-2 focus:text-vanilla">
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6">
        <a
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
          className="rounded-lg"
          aria-label={`${t.brand.name} — ${t.nav.home}`}
        >
          <Wordmark />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {navLink('home', t.nav.home)}
          {navLink('ask', t.nav.ask)}
          <button type="button" onClick={onOpenStandards} className="ui-text px-1 py-2 text-[0.95rem] text-matcha-ink transition-colors hover:text-forest">
            {t.nav.standards}
          </button>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher size="sm" />
          </div>
          {route === 'ask' && canStartNew && (
            <div className="hidden sm:block">
              <IconButton label={t.nav.newConversation} onClick={onNewConversation}>
                <MessageSquarePlus className="size-5" />
              </IconButton>
            </div>
          )}
          <IconButton label={t.nav.requests} onClick={onOpenRequests} className="relative">
            <UserRound className="size-5" />
            {requestCount > 0 && (
              <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-carob-ink text-[0.65rem] font-semibold text-vanilla" lang="en">
                {requestCount}
              </span>
            )}
          </IconButton>
          <div className="md:hidden">
            <IconButton label={t.nav.menu} onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </IconButton>
          </div>
        </div>
      </div>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={t.brand.name}>
        <nav aria-label="Mobile" className="flex flex-col gap-1 pb-2">
          {[
            { label: t.nav.home, action: () => onNavigate('home') },
            { label: t.nav.ask, action: () => onNavigate('ask') },
            ...(route === 'ask' && canStartNew ? [{ label: t.nav.newConversation, action: onNewConversation }] : []),
            { label: t.nav.standards, action: onOpenStandards },
            { label: t.nav.requests, action: onOpenRequests },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                item.action();
              }}
              className="ui-text rounded-xl px-3 py-3 text-start text-lg text-forest hover:bg-almond"
            >
              {item.label}
            </button>
          ))}
          <div className="mt-4 border-t border-almond pt-5">
            <p className="ui-text mb-2 text-sm text-matcha-ink">{t.nav.language}</p>
            <LanguageSwitcher />
          </div>
          <Button variant="primary" className="mt-6" onClick={() => { setMenuOpen(false); onNavigate('ask'); }} icon={<BookOpen className="size-4" />}>
            {t.home.ctaAsk}
          </Button>
        </nav>
      </Dialog>
    </header>
  );
}
