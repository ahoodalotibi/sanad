/** The association portal: dāʿīs see questions in their languages only, take one, and reply; supervisors add dāʿīs. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dirOf, nameIn, nativeName } from '../i18n/languages';
import { UI_LANGUAGES } from '../i18n/strings';
import { api, type QueueItem, type Specialist } from '../lib/api';
import { sendCode, signOut, useSession, verifyCode } from '../lib/auth';
import { formatDate, go, usePrefs } from '../lib/prefs';
import { useDictation } from '../lib/speech';
import { Dialog, LanguagePicker, Toast } from '../ui/common';
import { Back, Brand, Chat, Globe, Mic, Pencil, UserPlus } from '../ui/icons';

type Me = { roles: string[]; daee: Specialist | null; email: string | null };

function LangSelect() {
  const { ui, setUi } = usePrefs();
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Globe width={18} />
      <select value={ui} onChange={(e) => setUi(e.target.value)} aria-label="Language">
        {UI_LANGUAGES.map((c) => (
          <option key={c} value={c}>{nativeName(c)}</option>
        ))}
      </select>
    </label>
  );
}

function Login() {
  const { t } = usePrefs();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <div className="dark">
        <Brand dark />
        <div>
          <h1>{t.portal}</h1>
          <p>{t.portalTag}</p>
        </div>
      </div>
      <div className="form">
        <div style={{ alignSelf: 'flex-end' }} className="pill"><LangSelect /></div>
        <div className="inner">
          <h2 style={{ fontSize: 28, margin: '0 0 18px', color: 'var(--sanad-900)' }}>{t.daeeSignIn}</h2>
          {step === 'email' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t.emailErr);
                setBusy(true);
                const r = await sendCode(email.trim());
                setBusy(false);
                if (r === 'ok') (setStep('code'), setErr(null));
                else setErr(r === 'unavailable' ? t.authUnavailable : t.failed);
              }}
            >
              <label className="field">
                <span>{t.email}</span>
                <input className="input" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {err && <div className="err" role="alert">{err}</div>}
              <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy}>{t.sendCode}</button>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const ok = await verifyCode(email.trim(), code.trim());
                setBusy(false);
                if (!ok) setErr(t.otpErr);
              }}
            >
              <p style={{ color: 'var(--ink-2)' }}>{t.otpBody} <b dir="ltr">{email}</b></p>
              <p style={{ color: 'var(--ink-2)' }}>{t.linkBody}</p>
              <div style={{ fontSize: 14, color: 'var(--ink-3)', marginBottom: 6 }}>{t.codeLabel}</div>
              <input className="input otp" inputMode="numeric" dir="ltr" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label={t.otpTitle} />
              {err && <div className="err" role="alert">{err}</div>}
              <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={busy || code.length < 6}>{t.verify}</button>
              <button type="button" className="link" style={{ display: 'block', margin: '10px auto 0' }} onClick={() => (setStep('email'), setCode(''), setErr(null))}>{t.changeEmail}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Queue({ daee }: { daee: Specialist }) {
  const { t, ui } = usePrefs();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [tab, setTab] = useState<'new' | 'progress' | 'replied'>('new');
  const load = useCallback(() => api.queue().then((r) => setItems(r.items)).catch(() => setItems([])), []);
  useEffect(() => {
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);
  const groups = useMemo(() => {
    const all = items ?? [];
    return {
      new: all.filter((i) => i.status === 'pending'),
      progress: all.filter((i) => i.assignedToMe && (i.status === 'assigned' || i.status === 'in_review')),
      replied: all.filter((i) => i.assignedToMe && i.status === 'answered'),
    };
  }, [items]);
  const langs = daee.languages.map((l) => nameIn(l, ui)).join('، ');
  const shown = groups[tab];
  return (
    <>
      <h1 style={{ margin: 0, fontSize: 30, color: 'var(--sanad-900)' }}>{t.incoming}</h1>
      <div style={{ color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <Globe width={16} /> {t.showingIn(langs)}
      </div>
      <div className="tabs" role="tablist">
        {(['new', 'progress', 'replied'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {k === 'new' ? t.tabNew : k === 'progress' ? t.tabProgress : t.tabReplied}
            <span className="count">{groups[k].length}</span>
          </button>
        ))}
      </div>
      {items === null ? (
        <span className="dots"><i /><i /><i /></span>
      ) : shown.length === 0 ? (
        <p style={{ color: 'var(--ink-3)' }}>{t.queueEmpty}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.colQuestion}</th>
                <th>{t.colReason}</th>
                <th>{t.colLanguage}</th>
                <th>{t.colReceived}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id} className="click" onClick={() => go(`/portal/q/${i.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && go(`/portal/q/${i.id}`)}>
                  <td dir="auto" style={{ maxWidth: 420 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: tab === 'new' ? 600 : 400 }}>{i.question}</div>
                  </td>
                  <td><span className={'reason ' + i.reason}>{t.reasons[i.reason] ?? i.reason}</span></td>
                  <td>{nameIn(i.language, ui)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDate(i.createdAt, ui, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Detail({ id }: { id: string }) {
  const { t, ui } = usePrefs();
  const [item, setItem] = useState<QueueItem | null | undefined>(undefined);
  const [mode, setMode] = useState<'write' | 'voice'>('write');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dict = useDictation();
  const load = useCallback(() => api.queue().then((r) => setItem(r.items.find((i) => i.id === id) ?? null)).catch(() => setItem(null)), [id]);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (dict.text) setText(dict.text);
  }, [dict.text]);

  if (item === undefined) return <span className="dots"><i /><i /><i /></span>;
  if (item === null)
    return (
      <>
        <a className="link" href="#/portal">{t.pQuestions}</a>
        <p>{t.takenByOther}</p>
      </>
    );
  const act = async (fn: () => Promise<QueueItem>, ok?: string) => {
    setBusy(true);
    try {
      setItem(await fn());
      if (ok) setMsg(ok);
    } catch {
      setMsg(t.takenByOther);
      void load();
    } finally {
      setBusy(false);
    }
  };
  const mine = item.assignedToMe && (item.status === 'assigned' || item.status === 'in_review');
  return (
    <>
      <a className="link" href="#/portal" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingInlineStart: 0 }}>
        <Back width={18} /> {t.pQuestions}
      </a>
      <div className="split" style={{ marginTop: 12 }}>
        <div className="box">
          <small style={{ color: 'var(--ink-3)' }}>{t.askerQ}</small>
          <div dir={dirOf(item.language)} lang={item.language} className="prose" style={{ fontSize: 20, marginTop: 6 }}>{item.question}</div>
          <div className="meta">
            <span>{t.colLanguage}<b>{nameIn(item.language, ui)}</b></span>
            <span>{t.colReason}<b>{t.reasons[item.reason] ?? item.reason}</b></span>
            <span>{t.colReceived}<b>{formatDate(item.createdAt, ui, t)}</b></span>
            <span>#<b dir="ltr">{item.reference}</b></span>
          </div>
        </div>
        <div className="box">
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>{t.yourReply(nameIn(item.language, ui))}</h2>
          {item.status === 'pending' ? (
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => act(() => api.claim(item.id))}>{t.take}</button>
          ) : item.status === 'answered' ? (
            <div className="reply" dir={dirOf(item.language)}><div className="prose">{item.response}</div></div>
          ) : mine ? (
            <>
              <div className="toggle2">
                <button aria-pressed={mode === 'write'} onClick={() => (setMode('write'), dict.stop())}><Pencil width={18} /> {t.write}</button>
                <button aria-pressed={mode === 'voice'} onClick={() => setMode('voice')}><Mic width={18} /> {t.recordVoice}</button>
              </div>
              {mode === 'voice' && (
                <button className={'recbtn' + (dict.listening ? ' on' : '')} style={{ marginBottom: 10 }} onClick={() => (dict.listening ? dict.stop() : dict.start(item.language))}>
                  <span className="dot"><Mic /></span>
                  {dict.listening ? t.recStop : t.recStart}
                </button>
              )}
              <textarea className="textarea" style={{ minHeight: 200 }} dir={dirOf(item.language)} lang={item.language} value={text} onChange={(e) => setText(e.target.value)} />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => act(() => api.answer(item.id, text.trim()), t.replied)}>{t.sendReply}</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.release(item.id)).then(() => go('/portal'))}>{t.release}</button>
              </div>
            </>
          ) : (
            <p>{t.takenByOther}</p>
          )}
        </div>
      </div>
      {msg && <Toast text={msg} onDone={() => setMsg(null)} />}
    </>
  );
}

function Daees() {
  const { t, ui } = usePrefs();
  const [items, setItems] = useState<Specialist[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [langs, setLangs] = useState<string[]>([]);
  const [pick, setPick] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const load = () => api.daees().then((r) => setItems(r.items)).catch(() => undefined);
  useEffect(() => {
    void load();
    api.meta().then((m) => setAvailable(Object.keys(m.languages))).catch(() => undefined);
  }, []);
  const quick = [...new Set([...available, 'ar', 'en', 'ur'])].slice(0, 8);
  const toggle = (c: string) => setLangs((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const add = async () => {
    if (!name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || !langs.length) return setMsg(t.failed);
    try {
      await api.addDaee({ displayName: name.trim(), email: email.trim(), languages: langs });
      setName('');
      setEmail('');
      setLangs([]);
      setMsg(t.saved);
      void load();
    } catch {
      setMsg(t.failed);
    }
  };
  return (
    <div className="split">
      <div className="box">
        <h2 style={{ margin: 0, fontSize: 22 }}>{t.addDaee}</h2>
        <p style={{ color: 'var(--ink-3)', margin: '4px 0 0' }}>{t.addDaeeSub}</p>
        <label className="field"><span>{t.name}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>{t.email}</span><input className="input" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <div className="field"><span>{t.langsSpoken}</span>
          <div className="chips">
            {[...new Set([...quick, ...langs])].map((c) => (
              <button key={c} type="button" className={'chip' + (langs.includes(c) ? ' on' : '')} aria-pressed={langs.includes(c)} onClick={() => toggle(c)} lang={c}>{nativeName(c)}</button>
            ))}
            <button type="button" className="chip" onClick={() => setPick(true)} aria-label={t.searchLang}>+</button>
          </div>
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={add}>{t.add}</button>
      </div>
      <div className="box" style={{ padding: 0, overflow: 'hidden' }}>
        <h2 style={{ margin: 0, fontSize: 20, padding: 20 }}>{t.pDaees}</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ border: 0, borderRadius: 0 }}>
            <thead><tr><th>{t.colName}</th><th>{t.colEmail}</th><th>{t.colLangs}</th><th>{t.colStatus}</th></tr></thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{d.displayName}</td>
                  <td dir="ltr" style={{ fontSize: 13 }}>{d.email}</td>
                  <td>{d.languages.map((l) => nameIn(l, ui)).join('، ')}</td>
                  <td>
                    <button className="reason" style={{ border: 0 }} title={d.isActive ? t.deactivate : t.activate} onClick={() => api.updateDaee(d.id, { isActive: !d.isActive }).then(load)}>
                      {d.isActive ? t.active : t.inactive}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pick && (
        <Dialog title={t.langsSpoken} onClose={() => setPick(false)}>
          <LanguagePicker value={null} onPick={(c) => c && (toggle(c), setPick(false))} available={available} />
        </Dialog>
      )}
      {msg && <Toast text={msg} onDone={() => setMsg(null)} />}
    </div>
  );
}

export function Portal({ route }: { route: string[] }) {
  const { t } = usePrefs();
  const { session, ready } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!session) return setMe(null);
    api.me().then((r) => setMe({ roles: r.roles, daee: r.daee, email: r.user.email })).catch(() => setMe({ roles: [], daee: null, email: null }));
  }, [session]);

  if (!ready) return null;
  if (!session) return <Login />;
  if (!me) return <div className="state"><span className="dots"><i /><i /><i /></span></div>;
  const admin = me.roles.includes('admin');
  const daee = me.daee?.isActive ? me.daee : null;
  const page = route[1] === 'daees' && admin ? 'daees' : route[1] === 'q' && route[2] ? 'detail' : 'queue';

  return (
    <div className="portal">
      <aside>
        <div style={{ marginBottom: 18 }}><Brand dark sub={t.portal} /></div>
        <a className="navbtn" href="#/portal" aria-current={page !== 'daees' ? 'page' : undefined}><Chat width={18} /> {t.pQuestions}</a>
        {admin && <a className="navbtn" href="#/portal/daees" aria-current={page === 'daees' ? 'page' : undefined}><UserPlus width={18} /> {t.pDaees}</a>}
        <span className="spacer" />
        <LangSelect />
        <div className="me">
          <div>{me.daee?.displayName ?? me.email}</div>
          <small style={{ color: 'var(--sage-300)' }}>
            {[admin && t.supervisor, daee && `${t.daeeRole} · ${daee.languages.map((l) => nativeName(l)).join('، ')}`].filter(Boolean).join(' · ')}
          </small>
          <button className="link" style={{ color: '#fff', paddingInlineStart: 0, display: 'block' }} onClick={() => void signOut()}>{t.signOut}</button>
        </div>
      </aside>
      <section className="main">
        {page === 'daees' ? (
          <Daees />
        ) : !daee ? (
          <div className="box"><p style={{ margin: 0 }}>{admin ? t.addDaeeSub : t.notDaee}</p>{admin && <a className="btn btn-primary" style={{ marginTop: 12 }} href="#/portal/daees">{t.addDaee}</a>}</div>
        ) : page === 'detail' ? (
          <Detail id={route[2]} />
        ) : (
          <Queue daee={daee} />
        )}
      </section>
    </div>
  );
}
