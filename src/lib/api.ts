/** Calls to Sanad's own server. All religious content comes from these responses, never from the browser. */
import type { AskResponse, AskTurn } from '../../server/answer/contract';
import type { MyReferral, QueueItem, Specialist } from '../../server/accounts/types';

export type { AskResponse, AskTurn, MyReferral, QueueItem, Specialist };
export type { AnswerItem, HadithAnswer, QaAnswer, TermAnswer, ReferReason } from '../../server/answer/contract';

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

let tokenProvider: () => Promise<string | null> = async () => null;
export const setTokenProvider = (fn: () => Promise<string | null>) => (tokenProvider = fn);

async function call<T>(method: string, path: string, body?: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { code?: string }).code ?? 'HTTP_' + res.status);
  return data as T;
}

export interface Meta {
  ready: boolean;
  model: boolean;
  items: number;
  languages: Record<string, number>;
}

export const api = {
  meta: () => call<Meta>('GET', '/api/meta'),
  ask: (body: { question: string; uiLanguage?: string; language?: string; history?: AskTurn[]; clarifications?: number }) => call<AskResponse>('POST', '/api/ask', body),
  authConfig: () => call<{ url: string; publishableKey: string }>('GET', '/api/auth/config'),
  me: () => call<{ user: { id: string; email: string | null }; roles: string[]; daee: Specialist | null }>('GET', '/api/me', undefined, true),
  sendReferral: (body: { question: string; language: string; reason?: string; context?: string }) => call<MyReferral>('POST', '/api/referrals', body, true),
  myReferrals: () => call<{ items: MyReferral[] }>('GET', '/api/my/referrals', undefined, true),
  cancelReferral: (id: string) => call<MyReferral>('POST', `/api/my/referrals/${id}/cancel`, {}, true),
  queue: () => call<{ daee: { displayName: string; languages: string[] }; items: QueueItem[] }>('GET', '/api/daee/queue', undefined, true),
  claim: (id: string) => call<QueueItem>('POST', `/api/daee/referrals/${id}/claim`, {}, true),
  release: (id: string) => call<QueueItem>('POST', `/api/daee/referrals/${id}/release`, {}, true),
  answer: (id: string, response: string) => call<QueueItem>('POST', `/api/daee/referrals/${id}/answer`, { response }, true),
  daees: () => call<{ items: Specialist[] }>('GET', '/api/admin/daees', undefined, true),
  addDaee: (body: { email: string; displayName: string; languages: string[] }) => call<Specialist>('POST', '/api/admin/daees', body, true),
  updateDaee: (id: string, body: { displayName?: string; languages?: string[]; isActive?: boolean }) => call<Specialist>('PATCH', `/api/admin/daees/${id}`, body, true),
};
