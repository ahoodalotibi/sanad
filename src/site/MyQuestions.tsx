/** «أسئلتي»: the asker's questions to dāʿīs and their replies. */
import { useEffect, useState } from 'react';
import { api, type MyReferral } from '../lib/api';
import { useSession } from '../lib/auth';
import { formatDate, go, usePrefs } from '../lib/prefs';
import { SignInDialog } from '../ui/common';
import { Back, Chat, Next } from '../ui/icons';

export function MyQuestions({ id }: { id?: string }) {
  const { t, ui } = usePrefs();
  const { session, ready } = useSession();
  const [items, setItems] = useState<MyReferral[] | null>(null);
  const [err, setErr] = useState(false);
  const [signIn, setSignIn] = useState(false);

  const load = () =>
    api
      .myReferrals()
      .then((r) => (setItems(r.items), setErr(false)))
      .catch(() => setErr(true));
  useEffect(() => {
    if (session) void load();
  }, [session]);

  if (!ready) return null;
  if (!session)
    return (
      <div className="state">
        <div className="ic calm"><Chat /></div>
        <h2>{t.mqTitle}</h2>
        <p>{t.signInToSee}</p>
        <div className="btns">
          <button className="btn btn-primary" onClick={() => setSignIn(true)}>{t.signIn}</button>
        </div>
        {signIn && <SignInDialog onClose={() => setSignIn(false)} onDone={() => setSignIn(false)} />}
      </div>
    );
  if (err)
    return (
      <div className="state">
        <h2>{t.errTitle}</h2>
        <div className="btns"><button className="btn btn-primary" onClick={load}>{t.retry}</button></div>
      </div>
    );
  if (!items) return <div className="state"><span className="dots"><i /><i /><i /></span></div>;

  const current = id ? items.find((r) => r.id === id) : null;
  if (current)
    return (
      <div className="col">
        <a href="#/my" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingInlineStart: 0 }}>
          <Back width={18} /> {t.mqTitle}
        </a>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="tags">
            <span className={'status ' + current.status}>{t.status[current.status] ?? current.status}</span>
            <small style={{ color: 'var(--ink-3)' }}>{formatDate(current.createdAt, ui, t)}</small>
            <small style={{ color: 'var(--ink-3)' }} dir="ltr">{current.reference}</small>
          </div>
          <div className="qa-title" dir="auto" style={{ fontSize: 20 }}>{current.question}</div>
          {current.response ? (
            <div className="reply">
              <div className="who">
                <span className="ini">{(current.daeeName ?? '؟').trim().charAt(0)}</span>
                <span>
                  <small style={{ color: 'var(--ink-3)' }}>{t.replyFrom}</small>
                  <br />
                  <b style={{ fontWeight: 500 }}>{current.daeeName}</b>
                </span>
              </div>
              <div className="prose" dir="auto">{current.response}</div>
              {current.answeredAt && <small style={{ color: 'var(--ink-3)' }}>{formatDate(current.answeredAt, ui, t)}</small>}
            </div>
          ) : (
            <p style={{ color: 'var(--ink-2)' }}>{t.waitingBody}</p>
          )}
          {current.status === 'pending' && (
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => api.cancelReferral(current.id).then(load)}>{t.cancelQ}</button>
          )}
        </div>
      </div>
    );

  return (
    <div className="col">
      <div className="mq-head">
        <h1>{t.mqTitle}</h1>
        <span style={{ color: 'var(--ink-3)' }}>{t.count(items.length)}</span>
      </div>
      {items.length === 0 ? (
        <div className="state" style={{ marginTop: 30 }}>
          <div className="ic calm"><Chat /></div>
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
          <div className="btns"><button className="btn btn-primary" onClick={() => go('/')}>{t.ask}</button></div>
        </div>
      ) : (
        items.map((r) => (
          <a key={r.id} className="row-card" href={`#/my/${r.id}`}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="tags" style={{ marginBottom: 4 }}>
                <span className={'status ' + r.status}>{t.status[r.status] ?? r.status}</span>
                <small style={{ color: 'var(--ink-3)' }}>{formatDate(r.createdAt, ui, t)}</small>
              </span>
              <span dir="auto" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.question}</span>
            </span>
            <Next />
          </a>
        ))
      )}
    </div>
  );
}
