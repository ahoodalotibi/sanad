/** The answer screen: the text exactly as the source publishes it, its grade and source, and the way to a dāʿī. */
import { useState } from 'react';
import { dirOf, fontFor } from '../i18n/languages';
import type { AnswerItem, HadithAnswer, QaAnswer, TermAnswer } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { useReadAloud } from '../lib/speech';
import { Chat, Check, Chevron, External, Info, Speaker } from '../ui/icons';

function Fold({ title, open, onToggle, children }: { title: string; open: boolean; onToggle(): void; children: React.ReactNode }) {
  return (
    <div className="section">
      <button className="fold" aria-expanded={open} onClick={onToggle}>
        {title}
        <Chevron />
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function Notice({ item }: { item: AnswerItem }) {
  const { t } = usePrefs();
  if (item.translation === 'source') return null;
  return (
    <div className={'notice' + (item.translation === 'alternative' ? ' info' : '')} role="note">
      <Info style={{ flex: 'none', marginTop: 2 }} />
      <span>{item.translation === 'alternative' ? t.fallbackNotice : t.arabicOnlyNotice}</span>
    </div>
  );
}

const textLang = (item: AnswerItem) => (item.type === 'hadith' ? item.textLanguage : item.language);
const Txt = ({ lang, className, children }: { lang: string; className?: string; children: React.ReactNode }) => (
  <div lang={lang} dir={dirOf(lang)} className={className} style={{ fontFamily: lang === 'ar' && className === 'text-main' ? 'var(--arabic)' : fontFor(lang) }}>
    {children}
  </div>
);

function HadithCard({ item, explainOpen, setExplainOpen }: { item: HadithAnswer; explainOpen: boolean; setExplainOpen(v: boolean): void }) {
  const { t } = usePrefs();
  const [wordsOpen, setWordsOpen] = useState(false);
  const showArabicBelow = item.textLanguage !== 'ar';
  return (
    <article className="card" aria-label={t.hadithTag}>
      <div className="tags">
        <span className="badge" lang="ar" dir="rtl">
          <Check width={16} height={16} /> {item.grade}
        </span>
        {item.takhrij && <span lang="ar" dir="rtl" style={{ color: 'var(--ink-2)', fontSize: 15 }}>{item.takhrij}</span>}
      </div>
      {item.translation === 'source' && item.textLanguage !== 'ar' && <span className="dashed">{t.pubTrans}</span>}
      <Notice item={item} />
      <Txt lang={item.textLanguage} className="text-main">{item.text}</Txt>
      {showArabicBelow && (
        <div className="section">
          <div className="lbl">{t.original}</div>
          <div className="arabic" lang="ar" dir="rtl">{item.arabic}</div>
        </div>
      )}
      {item.explanation && (
        <Fold title={t.explain} open={explainOpen} onToggle={() => setExplainOpen(!explainOpen)}>
          <Txt lang={item.explanationLanguage ?? item.textLanguage} className="prose">{item.explanation}</Txt>
        </Fold>
      )}
      {item.wordMeanings.length > 0 && (
        <Fold title={t.words} open={wordsOpen} onToggle={() => setWordsOpen(!wordsOpen)}>
          <ul lang="ar" dir="rtl" style={{ margin: 0, paddingInlineStart: 20 }}>
            {item.wordMeanings.map((w, i) => (
              <li key={i}>
                <b>{w.word}</b>: {w.meaning}
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </article>
  );
}

function QaCard({ item, detailOpen, setDetailOpen }: { item: QaAnswer; detailOpen: boolean; setDetailOpen(v: boolean): void }) {
  const { t } = usePrefs();
  return (
    <article className="card" aria-label={t.qaTag}>
      <div className="tags">
        <span className="badge soft">
          <Chat width={16} height={16} /> {t.qaTag}
        </span>
      </div>
      <Notice item={item} />
      <Txt lang={item.language} className="qa-title">{item.question}</Txt>
      <div className="short">
        <div className="lbl">{t.shortLbl}</div>
        <Txt lang={item.language} className="prose">{item.shortAnswer}</Txt>
      </div>
      {item.detailedAnswer && (
        <Fold title={t.detailLbl} open={detailOpen} onToggle={() => setDetailOpen(!detailOpen)}>
          <Txt lang={item.language} className="prose">{item.detailedAnswer}</Txt>
        </Fold>
      )}
    </article>
  );
}

function TermCard({ item }: { item: TermAnswer }) {
  const { t } = usePrefs();
  return (
    <article className="card" aria-label={t.termTag}>
      <div className="tags">
        <span className="badge soft">{t.termTag}</span>
      </div>
      <Notice item={item} />
      <Txt lang={item.language} className="qa-title">{item.term}</Txt>
      {item.term !== item.arabicTerm && <div className="arabic" lang="ar" dir="rtl" style={{ fontSize: 22 }}>{item.arabicTerm}</div>}
      {item.definitions.map((d, i) => (
        <div className="section" key={i}>
          {d.label && <div className="lbl" lang={item.language}>{d.label}</div>}
          <Txt lang={item.language} className="prose">{d.text}</Txt>
        </div>
      ))}
    </article>
  );
}

const mainText = (it: AnswerItem) => (it.type === 'hadith' ? it.text : it.type === 'qa' ? `${it.question}. ${it.shortAnswer}` : `${it.term}. ${it.definitions.map((d) => d.text).join(' ')}`);
const titleOf = (it: AnswerItem) => (it.type === 'hadith' ? it.text : it.type === 'qa' ? it.question : it.term);

export function AnswerView({ question, items, onDaee }: { question: string; items: AnswerItem[]; onDaee(reason: 'user_request', context: string): void }) {
  const { t } = usePrefs();
  const [index, setIndex] = useState(0);
  const [explainOpen, setExplainOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [unclear, setUnclear] = useState(false);
  const read = useReadAloud();
  const item = items[index];
  const others = items.filter((_, i) => i !== index);

  const notUnderstood = () => {
    if (item.type === 'hadith' && item.explanation && !explainOpen) setExplainOpen(true);
    else if (item.type === 'qa' && item.detailedAnswer && !detailOpen) setDetailOpen(true);
    setUnclear(true);
  };

  return (
    <div className="wrap">
      <div className="asked">
        <span className="lbl">{t.youAsked}</span>
        <span className="bubble" dir="auto">{question}</span>
      </div>
      <div className="answer">
        <div>
          {item.type === 'hadith' && <HadithCard item={item} explainOpen={explainOpen} setExplainOpen={setExplainOpen} />}
          {item.type === 'qa' && <QaCard item={item} detailOpen={detailOpen} setDetailOpen={setDetailOpen} />}
          {item.type === 'term' && <TermCard item={item} />}
          {others.length > 0 && (
            <div className="more">
              <h2>{t.moreTexts}</h2>
              {others.map((o) => (
                <button key={o.id} className="mini" onClick={() => (setIndex(items.indexOf(o)), setUnclear(false), window.scrollTo(0, 0))}>
                  <span className="badge soft" style={{ fontSize: 12, marginBottom: 6 }}>{o.type === 'hadith' ? t.hadithTag : o.type === 'qa' ? t.qaTag : t.termTag}</span>
                  <div dir={dirOf(textLang(o))} lang={textLang(o)} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titleOf(o)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <aside className="side">
          <a className="src" href={item.source.url} target="_blank" rel="noopener noreferrer">
            <span>
              <span className="k">{t.source}</span>
              <br />
              <span className="name">{item.source.name}</span>
              {item.type === 'qa' && item.relatedBook && (
                <>
                  <br />
                  <span className="k">{t.relatedBook}: {item.relatedBook.name}</span>
                </>
              )}
            </span>
            <External style={{ flex: 'none' }} />
          </a>
          {read.available && (
            <button className="btn btn-ghost act" onClick={() => read.toggle(mainText(item), textLang(item))}>
              <Speaker /> {read.speaking ? t.stopListen : t.listen}
            </button>
          )}
          <button className="btn btn-ghost act" onClick={notUnderstood}>{t.notUnderstood}</button>
          {unclear && <div className="notice info" role="status">{t.stillUnclear}</div>}
          <button className="btn btn-primary act" onClick={() => onDaee('user_request', `${item.source.name}: ${item.source.url}`)}>
            <Chat /> {t.daee}
          </button>
        </aside>
      </div>
    </div>
  );
}
