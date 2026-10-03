/**
 * SANAD — application shell.
 * Behaviour is unchanged from the previous version (processQuery → local verified engine,
 * then /api/chat; voice playback; specialist tickets in localStorage). This file only
 * wires that behaviour to the redesigned interface.
 */
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { ChatPage } from './components/chat/ChatPage';
import { SpecialistDialog } from './components/dialogs/SpecialistDialog';
import { StandardsDialog } from './components/dialogs/StandardsDialog';
import { HomePage } from './components/home/HomePage';
import { SiteFooter } from './components/layout/SiteFooter';
import { SiteHeader } from './components/layout/SiteHeader';
import { useI18n } from './i18n/I18nProvider';
import { useHashRoute } from './lib/useHashRoute';
import { processQuery } from './services/ragEngine';
import { voiceService } from './services/voiceService';
import type { ChatMessage, SpecialistTicket } from './types';

const TICKETS_KEY = 'sanad_tickets';

function loadTickets(): SpecialistTicket[] {
  try {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(TICKETS_KEY) : null;
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const { lang } = useI18n();
  const [route, navigate] = useHashRoute();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true); // same default as before the redesign
  const [tickets, setTickets] = useState<SpecialistTicket[]>(loadTickets);

  const [standardsOpen, setStandardsOpen] = useState(false);
  const [specialist, setSpecialist] = useState<{ open: boolean; query: string; reason: string; tab: 'new' | 'mine'; sources: string[] }>({
    open: false,
    query: '',
    reason: 'personal_fatwa',
    tab: 'new',
    sources: [],
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
    } catch {
      /* storage unavailable */
    }
  }, [tickets]);

  const ask = useCallback(
    async (text: string, isVoice = false) => {
      const question = text.trim();
      if (!question || isLoading) return;
      if (route !== 'ask') navigate('ask');

      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: 'user', text: question, inputType: isVoice ? 'voice' : 'text', timestamp: new Date() }]);
      setIsLoading(true);
      try {
        const response = await processQuery(question, lang);
        setMessages((prev) => [...prev, { id: `s-${Date.now()}`, sender: 'sanad', text: response.answerText, timestamp: new Date(), responseDetails: response }]);
        if (autoSpeak && response.answerText) voiceService.speak(response.aiExplanation || response.answerText, lang);
      } catch (error) {
        console.error('Error generating response:', error);
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, sender: 'sanad', text: '', timestamp: new Date(), status: 'error', retryQuery: question }]);
      } finally {
        setIsLoading(false);
      }
    },
    [autoSpeak, isLoading, lang, navigate, route]
  );

  /** Retry replaces the failed answer and asks again, instead of duplicating the question. */
  const retry = useCallback(
    (question: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        const trimmed = last?.status === 'error' ? prev.slice(0, -1) : prev;
        const lastUser = trimmed[trimmed.length - 1];
        return lastUser?.sender === 'user' && lastUser.text === question ? trimmed.slice(0, -1) : trimmed;
      });
      void ask(question);
    },
    [ask]
  );

  const openSpecialist = (query: string, reason: string) => {
    // Pass along only sources this conversation actually consulted for that question.
    const answer = [...messages].reverse().find((m, i, arr) => m.sender === 'sanad' && arr[i + 1]?.text === query);
    const sources = answer?.responseDetails?.citations.map((c) => `${c.sourceName} — ${c.reference}`) ?? [];
    setSpecialist({ open: true, query, reason, tab: 'new', sources });
  };

  const newConversation = () => {
    voiceService.stopSpeaking();
    setMessages([]);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-dvh flex-col">
        <SiteHeader
          route={route}
          onNavigate={navigate}
          onOpenStandards={() => setStandardsOpen(true)}
          onOpenRequests={() => setSpecialist((s) => ({ ...s, open: true, query: '', reason: 'personal_fatwa', tab: tickets.length > 0 ? 'mine' : 'new', sources: [] }))}
          requestCount={tickets.length}
          canStartNew={messages.length > 0}
          onNewConversation={newConversation}
        />

        {route === 'ask' ? (
          <ChatPage
            messages={messages}
            isLoading={isLoading}
            onSend={ask}
            onRetry={retry}
            onRequestSpecialist={openSpecialist}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
          />
        ) : (
          <>
            <HomePage onAsk={() => navigate('ask')} />
            <SiteFooter onNavigate={navigate} onOpenStandards={() => setStandardsOpen(true)} />
          </>
        )}

        <StandardsDialog open={standardsOpen} onClose={() => setStandardsOpen(false)} onRunTest={(q) => void ask(q)} />
        <SpecialistDialog
          open={specialist.open}
          onClose={() => setSpecialist((s) => ({ ...s, open: false }))}
          initialQuery={specialist.query}
          initialReason={specialist.reason}
          initialTab={specialist.tab}
          consultedSources={specialist.sources}
          tickets={tickets}
          onSubmit={(ticket) => setTickets((prev) => [ticket, ...prev])}
        />
      </div>
    </MotionConfig>
  );
}
