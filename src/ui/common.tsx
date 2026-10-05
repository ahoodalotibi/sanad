/** Shared pieces: dialog, sign-in dialog, language picker, settings dialog. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ALL_LANGUAGES, dirOf, nameIn, nativeName, searchKey } from '../i18n/languages';
import { UI_LANGUAGES } from '../i18n/strings';
import { sendCode, useSession, verifyCode } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { Check, Close, Search } from './icons';

export function Dialog({ title, onClose, children, wide, action }: { title: string; onClose(): void; children: ReactNode; wide?: boolean; action?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'dialog' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="head">
          <h2>{title}</h2>
          {action ?? (
            <button className="pill" onClick={onClose} aria-label="close" style={{ minHeight: 40, padding: '0 10px' }}>
              <Close />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Email → code → signed in. */
export function SignInDialog({ onClose, onDone, note }: { onClose(): void; onDone(): void; note?: string }) {
  const { t } = usePrefs();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { session } = useSession();
  // signed in through the email link (possibly in another tab)
  useEffect(() => {
    if (session) onDone();
  }, [session, onDone]);

  const submitEmail = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t.emailErr);
    setBusy(true);
    const r = await sendCode(email.trim());
    setBusy(false);
    if (r === 'ok') {
      setErr(null);
      setStep('code');
    } else setErr(r === 'unavailable' ? t.authUnavailable : t.failed);
  };
  const submitCode = async () => {
    setBusy(true);
    const ok = await verifyCode(email.trim(), code.trim());
    setBusy(false);
    if (ok) onDone();
    else setErr(t.otpErr);
  };

  return (
    <Dialog title={step === 'email' ? t.mTitle : t.otpTitle} onClose={onClose}>
      {step === 'email' ? (
        <form onSubmit={(e) => (e.preventDefault(), submitEmail())}>
          <p style={{ marginTop: 0, color: 'var(--ink-2)' }}>{note ?? t.mBody}</p>
          <label className="field">
            <span>{t.email}</span>
            <input className="input" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy}>{t.sendCode}</button>
        </form>
      ) : (
        <form onSubmit={(e) => (e.preventDefault(), submitCode())}>
          <p style={{ marginTop: 0, color: 'var(--ink-2)' }}>
            {t.otpBody} <b dir="ltr">{email}</b>
          </p>
          <input className="input otp" inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label={t.otpTitle} />
          {err && <div className="err" role="alert">{err}</div>}
          <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy || code.length < 6}>{t.verify}</button>
          <button type="button" className="link" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => (setStep('email'), setCode(''), setErr(null))}>{t.changeEmail}</button>
        </form>
      )}
    </Dialog>
  );
}

/** Searchable list of every language. `available` (if given) are listed first. */
export function LanguagePicker({ value, onPick, auto, available, height = 280 }: { value: string | null; onPick(code: string | null): void; auto?: { label: string; sub: string }; available?: string[]; height?: number }) {
  const { t, ui } = usePrefs();
  const [q, setQ] = useState('');
  const ordered = useMemo(() => {
    const first = [...new Set([...(available ?? []), ...UI_LANGUAGES])];
    const rest = ALL_LANGUAGES.filter((c) => !first.includes(c)).sort((a, b) => nameIn(a, ui).localeCompare(nameIn(b, ui), ui));
    return [...first, ...rest];
  }, [available, ui]);
  const keys = useMemo(() => new Map(ordered.map((c) => [c, searchKey(c, ui)])), [ordered, ui]);
  const shown = q.trim() ? ordered.filter((c) => keys.get(c)!.includes(q.trim().toLocaleLowerCase())) : ordered;
  return (
    <div>
      {auto && (
        <button className="autorow" aria-selected={value === null} onClick={() => onPick(null)} style={{ marginBottom: 8 }}>
          <span>
            <b style={{ fontWeight: 500 }}>{auto.label}</b>
            <br />
            <small style={{ color: 'var(--ink-3)' }}>{auto.sub}</small>
          </span>
          {value === null && <Check />}
        </button>
      )}
      <label style={{ position: 'relative', display: 'block' }}>
        <span className="sr-only">{t.searchLang}</span>
        <input className="input" placeholder={t.searchLang} value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 40 }} />
        <Search style={{ position: 'absolute', insetInlineStart: 12, top: 14, color: 'var(--ink-3)' }} />
      </label>
      <div className="langlist" role="listbox" aria-label={t.langLabel} style={{ maxHeight: height }}>
        {shown.length === 0 && <div style={{ padding: 14, color: 'var(--ink-3)' }}>{t.noLang}</div>}
        {shown.map((c) => (
          <button key={c} role="option" className="langrow" aria-selected={value === c} onClick={() => onPick(c)}>
            <span lang={c} dir={dirOf(c)}>{nativeName(c)}</span>
            <small>{nameIn(c, ui)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsDialog({ onClose, available }: { onClose(): void; available?: string[] }) {
  const p = usePrefs();
  const { t } = p;
  return (
    <Dialog
      title={t.setTitle}
      onClose={onClose}
      action={<button className="btn btn-dark" onClick={onClose}>{t.done}</button>}
    >
      <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 6 }}>{t.ifaceLang}</div>
      <LanguagePicker
        value={p.uiAuto ? null : p.ui}
        onPick={(c) => (c ? p.setUi(c) : p.setUiAuto(true))}
        auto={{ label: t.autoRow, sub: t.autoSub }}
        available={available}
      />
      <div style={{ fontSize: 14, color: 'var(--ink-2)', margin: '18px 0 6px' }}>{t.textSize}</div>
      <div className="sizes">
        {t.sizes.map((s, i) => (
          <button key={s} aria-pressed={p.size === i} onClick={() => p.setSize(i)} style={{ fontSize: 14 + i * 3 }}>{s}</button>
        ))}
      </div>
      <label className="switch">
        <span>{t.contrast}</span>
        <input type="checkbox" checked={p.contrast} onChange={(e) => p.setContrast(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--sanad-700)' }} />
      </label>
    </Dialog>
  );
}

export function Toast({ text, onDone }: { text: string; onDone(): void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);
  return <div className="toast" role="status">{text}</div>;
}
