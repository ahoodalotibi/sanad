/** Sending a question to a dāʿī who speaks the asker's language. */
import { useEffect, useRef, useState } from 'react';
import { api, type ReferReason } from '../lib/api';
import { savePending, useSession } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { canListen, useDictation } from '../lib/speech';
import { SignInDialog } from '../ui/common';
import { Mic, Pencil, User } from '../ui/icons';

export interface ReferRequest {
  question: string;
  language: string;
  reason: ReferReason;
  context?: string;
}

export function ReferForm({ req, onSent }: { req: ReferRequest; onSent(reference: string): void }) {
  const { t } = usePrefs();
  const { session } = useSession();
  const [method, setMethod] = useState<'written' | 'voice'>('written');
  const [text, setText] = useState(req.question);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const dict = useDictation();
  const base = useRef('');
  useEffect(() => {
    if (dict.text) setText((base.current ? base.current + ' ' : '') + dict.text);
  }, [dict.text]);
  const startVoice = () => {
    base.current = text.trim();
    dict.start(req.language);
  };

  const kind = req.reason === 'personal_case' ? 'personal' : req.reason === 'user_request' ? 'help' : 'noref';
  const title = kind === 'personal' ? t.rPersonalT : kind === 'help' ? t.rHelpT : t.rNoRefT;
  const body = kind === 'personal' ? t.rPersonalB : kind === 'help' ? t.rHelpB : t.rNoRefB;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.sendReferral({ question: text.trim(), language: req.language, reason: req.reason, context: req.context });
      onSent(r.reference);
    } catch {
      setErr(t.failed);
    } finally {
      setBusy(false);
    }
  };
  const submit = () => {
    if (!text.trim()) return setErr(t.emptyQ);
    if (!consent) return setErr(t.consentErr);
    setErr(null);
    if (!session) {
      // kept until the asker is signed in (by code here, or by the email link in any tab), then sent once
      savePending({ question: text.trim(), language: req.language, reason: req.reason, context: req.context });
      setSignIn(true);
    } else void send();
  };

  return (
    <div className="col">
      <div className="banner">
        <h2>
          <User /> {title}
        </h2>
        <p>{body}</p>
      </div>
      {canListen() && (
        <>
          <div style={{ margin: '20px 0 8px', fontWeight: 500 }}>{t.howSend}</div>
          <div className="seg">
            <button aria-pressed={method === 'written'} onClick={() => (setMethod('written'), dict.stop())}>
              <Pencil /> {t.written}
            </button>
            <button aria-pressed={method === 'voice'} onClick={() => setMethod('voice')}>
              <Mic /> {t.voice}
            </button>
          </div>
        </>
      )}
      {method === 'voice' && (
        <>
          <p className="hint" style={{ textAlign: 'start' }}>{t.voiceNote}</p>
          <button className={'recbtn' + (dict.listening ? ' on' : '')} onClick={() => (dict.listening ? dict.stop() : startVoice())}>
            <span className="dot"><Mic /></span>
            {dict.listening ? t.recStop : t.recStart}
          </button>
        </>
      )}
      <label className="field">
        <span>{t.yourQ}</span>
        <textarea className="textarea" dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          <b style={{ fontWeight: 500 }}>{t.consent}</b>
          <br />
          <small style={{ color: 'var(--ink-3)' }}>{t.consentNote}</small>
        </span>
      </label>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-primary btn-block" style={{ marginTop: 20, minHeight: 56 }} onClick={submit} disabled={busy}>{t.sendDaee}</button>
      {!session && <p className="hint">{t.signNote}</p>}
      {signIn && <SignInDialog onClose={() => setSignIn(false)} onDone={() => setSignIn(false)} />}
    </div>
  );
}
