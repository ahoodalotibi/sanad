/** The public site: ask → (clarify) → answer from the sources, or → a dāʿī who speaks your language. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { nativeName } from '../i18n/languages';
import { api, ApiError, type AnswerItem, type AskTurn, type ReferReason } from '../lib/api';
import { signOut, useSession } from '../lib/auth';
import { go, usePrefs, useRoute } from '../lib/prefs';
import { canListen, useDictation } from '../lib/speech';
import { Dialog, LanguagePicker, SettingsDialog, Toast } from '../ui/common';
import { Arrow, Back, Brand, Check, Globe, Info, Mic, MicOff, Next, Search, WifiOff } from '../ui/icons';
import { AnswerView } from './AnswerView';
import { MyQuestions } from './MyQuestions';
import { ReferForm, type ReferRequest } from './Refer';

type View =
  | { k: 'home' }
  | { k: 'loading'; q: string }
  | { k: 'answer'; q: string; items: AnswerItem[]; language: string }
  | { k: 'clarify'; q: string; question: string; options: string[]; history: AskTurn[]; clarifications: number; language: string }
  | { k: 'refer'; req: ReferRequest }
  | { k: 'noResults'; q: string; language: string; reason: ReferReason; context?: string }
  | { k: 'error'; q: string; busy: boolean }
  | { k: 'mic' }
  | { k: 'sent'; reference: string };

function Header({ onSettings }: { onSettings(): void }) {
  const { t, ui, uiAuto } = usePrefs();
  const { session } = useSession();
  return (
    <header className="top">
      <div className="wrap">
        <Brand />
        <span className="spacer" />
        <button className="pill" onClick={onSettings} aria-label={t.setTitle}>
          <Globe width={18} /> <span>{uiAuto && ui === 'en' ? 'Language' : nativeName(ui)}</span>
        </button>
        <a className="link hide-sm" href="#/my">{t.myQ}</a>
        {session ? (
          <button className="btn btn-dark" onClick={() => void signOut()}>{t.signOut}</button>
        ) : (
          <a className="btn btn-dark" href="#/my">{t.signIn}</a>
        )}
      </div>
    </header>
  );
}

function Home({ initial, onAsk, onMicUnsupported, languages }: { initial: string; onAsk(q: string): void; onMicUnsupported(): void; languages: string[] }) {
  const { t, answerLang, setAnswerLang, ui } = usePrefs();
  const [q, setQ] = useState(initial);
  const [listen, setListen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const dict = useDictation();
  const box = useRef<HTMLTextAreaElement>(null);

  const startVoice = () => {
    if (!canListen()) return onMicUnsupported();
    setListen(true);
    dict.start(answerLang ?? undefined);
  };
  const stopVoice = () => {
    dict.stop();
    if (dict.text) setQ(dict.text);
    setListen(false);
    setTimeout(() => box.current?.focus(), 50);
  };
  useEffect(() => {
    if (!dict.listening && listen && dict.text) {
      setQ(dict.text);
      setListen(false);
    }
  }, [dict.listening, dict.text, listen]);

  const submit = () => q.trim() && onAsk(q.trim());
  return (
    <div className="wrap hero">
      <h1>{t.h1}</h1>
      <p className="sub">{t.sub}</p>
      <form className="askbox" onSubmit={(e) => (e.preventDefault(), submit())}>
        <label className="sr-only" htmlFor="q">{t.placeholder}</label>
        <textarea
          id="q"
          ref={box}
          dir="auto"
          rows={2}
          placeholder={t.placeholder}
          value={q}
          maxLength={1000}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), submit())}
        />
        <div className="row">
          <button type="button" className="chip" onClick={() => setLangOpen(true)}>
            <Globe width={16} /> {answerLang ? `${t.langLabel}: ${nativeName(answerLang)}` : t.autoDetect}
          </button>
          <span className="spacer" />
          <button type="button" className="round mic" onClick={startVoice} aria-label={t.speak}>
            <Mic />
          </button>
          <button className="round go" disabled={!q.trim()} aria-label={t.send}>
            <Arrow />
          </button>
        </div>
      </form>
      <div className="examples">
        <div className="label">{t.examplesLabel}</div>
        <div className="list">
          {t.ex.map((e) => (
            <button key={e} className="example" onClick={() => onAsk(e)}>{e}</button>
          ))}
        </div>
      </div>
      <ol className="steps" style={{ listStyle: 'none', padding: 0 }}>
        {t.steps.map((s, i) => (
          <li key={s} className={'step' + (i === 2 ? ' last' : '')}>
            <span className="n">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="note" role="note">
        <Info width={18} style={{ flex: 'none' }} /> {t.disclaimer}
      </div>

      {listen && (
        <Dialog title={t.listening} onClose={() => (dict.cancel(), setListen(false))}>
          <div className="listening">
            <div className="wave" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
            <div className="live" dir="auto" aria-live="polite">{dict.text}</div>
            <p className="hint">{t.reviewHint}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => (dict.cancel(), setListen(false))}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={stopVoice}>{t.stop}</button>
            </div>
          </div>
        </Dialog>
      )}
      {langOpen && (
        <Dialog title={t.langLabel} onClose={() => setLangOpen(false)}>
          <LanguagePicker
            value={answerLang}
            onPick={(c) => (setAnswerLang(c), setLangOpen(false))}
            auto={{ label: t.autoRow, sub: t.autoSub }}
            available={languages.length ? languages : [ui]}
          />
        </Dialog>
      )}
    </div>
  );
}

function State({ icon, calm, title, body, children }: { icon: React.ReactNode; calm?: boolean; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="state" role="status">
        <div className={'ic' + (calm ? ' calm' : '')}>{icon}</div>
        <h2>{title}</h2>
        <p>{body}</p>
        <div className="btns">{children}</div>
      </div>
    </div>
  );
}

export function Site() {
  const route = useRoute();
  const prefs = usePrefs();
  const { t, ui, answerLang } = prefs;
  const [view, setView] = useState<View>({ k: 'home' });
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);

  useEffect(() => {
    api.meta().then((m) => setLanguages(Object.keys(m.languages))).catch(() => undefined);
  }, []);

  const ask = useCallback(
    async (q: string, extra: { history?: AskTurn[]; clarifications?: number } = {}) => {
      setDraft(q);
      setView({ k: 'loading', q });
      go('/');
      try {
        const r = await api.ask({ question: q, uiLanguage: ui, language: answerLang ?? undefined, ...extra });
        prefs.follow(r.language);
        const context = extra.history?.filter((h) => h.role === 'user').map((h) => h.text).join('\n') || undefined;
        if (r.kind === 'greeting') {
          setView({ k: 'home' });
          setToast(t.greeting);
        } else if (r.kind === 'answer') setView({ k: 'answer', q, items: r.items, language: r.language });
        else if (r.kind === 'clarify')
          setView({ k: 'clarify', q, question: r.question, options: r.options, history: [...(extra.history ?? []), { role: 'user', text: q }, { role: 'assistant', text: r.question }], clarifications: (extra.clarifications ?? 0) + 1, language: r.language });
        else if (r.reason === 'personal_case' || r.reason === 'user_request') setView({ k: 'refer', req: { question: q, language: r.language, reason: r.reason, context } });
        else setView({ k: 'noResults', q, language: r.language, reason: r.reason, context });
      } catch (e) {
        setView({ k: 'error', q, busy: e instanceof ApiError && (e.status === 503 || e.status === 429) });
      }
    },
    [ui, answerLang, prefs, t.greeting]
  );

  let body: React.ReactNode;
  if (route[0] === 'my') body = <MyQuestions id={route[1]} />;
  else if (view.k === 'home') body = <Home initial={draft} onAsk={ask} onMicUnsupported={() => setView({ k: 'mic' })} languages={languages} />;
  else if (view.k === 'loading')
    body = (
      <div className="wrap">
        <div className="asked"><span className="lbl">{t.youAsked}</span><span className="bubble" dir="auto">{view.q}</span></div>
        <div className="state" role="status" aria-live="polite">
          <span className="dots"><i /><i /><i /></span>
          <h2 style={{ marginTop: 16 }}>{t.loadTitle}</h2>
          <p>{t.loadBody}</p>
        </div>
      </div>
    );
  else if (view.k === 'answer')
    body = <AnswerView question={view.q} items={view.items} onDaee={(reason, context) => setView({ k: 'refer', req: { question: view.q, language: view.language, reason, context } })} />;
  else if (view.k === 'clarify')
    body = (
      <div className="col">
        <div className="asked"><span className="lbl">{t.youAsked}</span><span className="bubble" dir="auto">{view.q}</span></div>
        <div className="bot">
          <span className="av"><Check width={16} color="#fff" /></span>
          <div className="msg">
            <b style={{ fontWeight: 600 }}>{t.didYouMean}</b>
            <div dir="auto">{view.question}</div>
            <small style={{ color: 'var(--ink-3)' }}>{t.clarHint}</small>
          </div>
        </div>
        {view.options.map((o) => (
          <button key={o} className="option" dir="auto" onClick={() => ask(o, { history: view.history, clarifications: view.clarifications })}>
            {o} <Next width={18} />
          </button>
        ))}
        <button className="option quiet" onClick={() => setView({ k: 'refer', req: { question: view.q, language: view.language, reason: 'unclear' } })}>{t.none}</button>
      </div>
    );
  else if (view.k === 'refer') body = <ReferForm req={view.req} onSent={(reference) => setView({ k: 'sent', reference })} />;
  else if (view.k === 'noResults') {
    const out = view.reason === 'out_of_scope';
    body = (
      <State icon={<Search />} title={out ? t.outTitle : t.noResTitle} body={out ? t.outBody : t.noResBody}>
        <button className="btn btn-primary" onClick={() => setView({ k: 'refer', req: { question: view.q, language: view.language, reason: view.reason, context: view.context } })}>{t.daee}</button>
        <button className="btn btn-ghost" onClick={() => setView({ k: 'home' })}>{t.rephrase}</button>
      </State>
    );
  } else if (view.k === 'error')
    body = (
      <State icon={<WifiOff />} title={view.busy ? t.busyTitle : t.errTitle} body={view.busy ? t.busyBody : t.errBody}>
        <button className="btn btn-primary" onClick={() => ask(view.q)}>{t.retry}</button>
      </State>
    );
  else if (view.k === 'mic')
    body = (
      <State icon={<MicOff />} calm title={t.micTitle} body={t.micBody}>
        <button className="btn btn-primary" onClick={() => setView({ k: 'home' })}>{t.typeInstead}</button>
      </State>
    );
  else
    body = (
      <State icon={<Check />} calm title={t.okTitle} body={t.okBody}>
        <p style={{ margin: '0 0 8px' }}>{t.reference}: <b dir="ltr">{view.reference}</b></p>
        <a className="btn btn-primary" href="#/my">{t.goMQ}</a>
        <button className="btn btn-ghost" onClick={() => (setDraft(''), setView({ k: 'home' }))}>{t.askAnother}</button>
      </State>
    );

  const showBack = route[0] !== 'my' && view.k !== 'home' && view.k !== 'loading';
  return (
    <>
      <a className="skip" href="#main">{t.skip}</a>
      <Header onSettings={() => setSettings(true)} />
      <main id="main">
        {showBack && (
          <div className="wrap" style={{ marginBottom: 8 }}>
            <button className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingInlineStart: 0 }} onClick={() => setView({ k: 'home' })}>
              <Back width={18} /> {t.back}
            </button>
          </div>
        )}
        {body}
      </main>
      {settings && <SettingsDialog onClose={() => setSettings(false)} available={languages} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}
