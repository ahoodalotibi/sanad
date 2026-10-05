/**
 * The language model's narrow role (server side only):
 *   1. understand  — the question's language, whether it is clear, personal, in scope; search keywords
 *   2. select      — which retrieved items (by id) directly answer the question, or none
 * It never writes religious content: its outputs are ids, labels, keywords, and — when the question
 * is unclear — a short clarification question in the asker's language that restates their own words.
 *
 * Works with any OpenAI-compatible chat endpoint. Defaults to Google Gemini:
 *   LLM_API_KEY      required to enable the model (Gemini key from aistudio.google.com)
 *   LLM_BASE_URL     default https://generativelanguage.googleapis.com/v1beta/openai/
 *   LLM_MODEL        default gemini-2.5-flash-lite
 */
import { z } from 'zod';

export interface LlmSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export function readLlmSettings(env: Record<string, string | undefined> = process.env): LlmSettings | null {
  const apiKey = env.LLM_API_KEY?.trim() || env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (env.LLM_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai/').replace(/\/?$/, '/'),
    model: env.LLM_MODEL?.trim() || 'gemini-2.5-flash-lite',
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 20000,
  };
}

export interface Llm {
  json<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T>;
}

export function createLlm(settings: LlmSettings, fetchImpl: typeof fetch = fetch): Llm {
  return {
    async json(system, user, schema) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), settings.timeoutMs);
      try {
        const res = await fetchImpl(`${settings.baseUrl}chat/completions`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
          body: JSON.stringify({
            model: settings.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
        if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const text = data.choices?.[0]?.message?.content ?? '';
        const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
        return schema.parse(json);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Step 1: understand the question
// ---------------------------------------------------------------------------
export const Understanding = z.object({
  language: z.string().min(2).max(10),
  category: z.enum(['question', 'personal_case', 'out_of_scope', 'request_human', 'greeting']),
  clear: z.boolean(),
  clarify_question: z.string().nullable().optional(),
  clarify_options: z.array(z.string()).max(3).optional(),
  keywords_ar: z.array(z.string()).max(8),
  keywords_en: z.array(z.string()).max(8),
});
export type Understanding = z.infer<typeof Understanding>;

export const UNDERSTAND_SYSTEM = `You route questions for "Sanad", a service that answers people's questions about Islam ONLY with texts from approved sources (authentic hadith with their grades, published Q&A, a dictionary of Islamic terms). You never answer the question yourself.

Return JSON with:
- language: ISO 639-1 code of the language the user wrote in (e.g. "en", "ur", "bn", "fr", "id", "tr", "ar", "tl"). Romanised Urdu/Hindi counts as "ur"/"hi".
- category:
  "question" — a general question about Islam, its beliefs, worship, the Prophet ﷺ, hadith, Quran, ethics, terms, or a common misconception.
  "personal_case" — asks for a ruling on the user's own or a specific person's situation (marriage, divorce, inheritance, contracts, money, medical/legal matters, "can I…", "my husband…", "I did…"), i.e. needs a fatwa from a qualified person.
  "out_of_scope" — not about Islam or religion at all.
  "request_human" — the user explicitly asks to talk to a person / scholar / daee.
  "greeting" — only a greeting or thanks with no question.
- clear: false only if the question is too vague to search (e.g. one ambiguous word, or it could mean clearly different things). Most questions are clear.
- clarify_question / clarify_options: only when clear=false. Ask in the user's language which meaning they intend; options are 2–3 short rephrasings of THEIR question. Do not state any religious information.
- keywords_ar: 3–8 Arabic search keywords/phrases (classical terms used in hadith and Islamic texts) for what the user asks.
- keywords_en: 3–8 English search keywords for the same.
Previous turns may be given; use them only to resolve what the current message refers to.`;

// ---------------------------------------------------------------------------
// Step 2: select the items that answer it
// ---------------------------------------------------------------------------
export const Selection = z.object({
  selected: z.array(z.string()).max(3),
  reason: z.string().max(300).optional(),
});
export type Selection = z.infer<typeof Selection>;

export const SELECT_SYSTEM = `You check search results for "Sanad". You are given a user's question and numbered candidate texts from approved sources (hadith, Q&A, dictionary entries), each with an id.
Select the ids (at most 3, best first) whose text DIRECTLY answers or addresses what the user asked. A text that only shares words with the question, or is about a different matter, must NOT be selected. If none directly addresses the question, return an empty list — that is the correct answer whenever in doubt.
Return JSON: {"selected": ["id", ...], "reason": "short reason"}. Never add, rewrite or explain religious content.`;
