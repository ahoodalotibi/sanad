/**
 * In-memory AccountsStore — used by tests and for running the portal locally without Supabase.
 * Mirrors the rules of the Supabase store (claim only pending questions in the daee's languages, etc.).
 */
import { randomUUID } from 'node:crypto';
import type { AccountsStore, AuthUser, MyReferral, NewReferral, QueueItem, Role, Specialist, ReferralStatus, DbHandoffReason } from './types.ts';

interface Row {
  id: string;
  reference: string;
  userId: string;
  question: string;
  context: string | null;
  language: string;
  reason: DbHandoffReason;
  status: ReferralStatus;
  specialistId: string | null;
  response: string | null;
  createdAt: string;
  answeredAt: string | null;
}

export function createMemoryAccountsStore(seed: { tokens?: Record<string, AuthUser> } = {}) {
  const tokens = new Map(Object.entries(seed.tokens ?? {}));
  const users = new Map<string, AuthUser>([...tokens.values()].map((u) => [u.id, u]));
  const roles = new Map<string, Set<Role>>();
  const specialists = new Map<string, Specialist>();
  const languages = new Set<string>(['ar', 'en']);
  const rows: Row[] = [];
  let seq = 0;
  let clock = Date.parse('2026-10-05T10:00:00Z');
  const now = () => new Date((clock += 1000)).toISOString();

  const specialistOf = (userId: string) => [...specialists.values()].find((s) => s.userId === userId) ?? null;
  const toMine = (r: Row): MyReferral => ({
    id: r.id,
    reference: r.reference,
    question: r.question,
    language: r.language,
    status: r.status,
    response: r.status === 'answered' || r.status === 'closed' ? r.response : null,
    daeeName: r.specialistId ? specialists.get(r.specialistId)?.displayName ?? null : null,
    createdAt: r.createdAt,
    answeredAt: r.answeredAt,
  });
  const toQueue = (r: Row, s: Specialist): QueueItem => ({
    id: r.id,
    reference: r.reference,
    question: r.context ? `${r.context}\n—\n${r.question}` : r.question,
    language: r.language,
    reason: r.reason,
    status: r.status,
    response: r.response,
    createdAt: r.createdAt,
    assignedToMe: r.specialistId === s.id,
  });
  const userByEmail = (email: string): AuthUser => {
    const found = [...users.values()].find((u) => u.email === email.toLowerCase());
    if (found) return found;
    const u = { id: randomUUID(), email: email.toLowerCase() };
    users.set(u.id, u);
    return u;
  };

  const store: AccountsStore & { languages: Set<string>; addToken(token: string, user: AuthUser): void } = {
    languages,
    addToken(token, user) {
      tokens.set(token, user);
      users.set(user.id, user);
    },
    async verifyToken(token) {
      return tokens.get(token) ?? null;
    },
    async getProfile(userId) {
      return { roles: [...(roles.get(userId) ?? [])], specialist: specialistOf(userId) };
    },
    async ensureLanguage(code) {
      languages.add(code);
    },

    async createReferral(input: NewReferral) {
      const r: Row = {
        id: randomUUID(),
        reference: `SND-${String(++seq).padStart(6, '0')}`,
        userId: input.userId,
        question: input.question,
        context: input.context,
        language: input.language,
        reason: input.reason,
        status: 'pending',
        specialistId: null,
        response: null,
        createdAt: now(),
        answeredAt: null,
      };
      rows.push(r);
      return toMine(r);
    },
    async listMyReferrals(userId) {
      return rows.filter((r) => r.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toMine);
    },
    async cancelReferral(userId, id) {
      const r = rows.find((x) => x.id === id && x.userId === userId && x.status === 'pending');
      if (!r) return null;
      r.status = 'cancelled';
      return toMine(r);
    },

    async listQueue(s) {
      return rows
        .filter((r) => (r.status === 'pending' && s.languages.includes(r.language)) || (r.specialistId === s.id && ['assigned', 'in_review', 'answered'].includes(r.status)))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((r) => toQueue(r, s));
    },
    async claim(s, id) {
      const r = rows.find((x) => x.id === id && x.status === 'pending' && s.languages.includes(x.language));
      if (!r) return null;
      r.status = 'assigned';
      r.specialistId = s.id;
      return toQueue(r, s);
    },
    async release(s, id) {
      const r = rows.find((x) => x.id === id && x.specialistId === s.id && ['assigned', 'in_review'].includes(x.status));
      if (!r) return null;
      r.status = 'pending';
      r.specialistId = null;
      return toQueue(r, s);
    },
    async answer(s, id, response) {
      const r = rows.find((x) => x.id === id && x.specialistId === s.id && ['assigned', 'in_review'].includes(x.status));
      if (!r) return null;
      r.status = 'answered';
      r.response = response;
      r.answeredAt = now();
      return toQueue(r, s);
    },

    async listSpecialists() {
      return [...specialists.values()];
    },
    async upsertSpecialist(input) {
      const user = userByEmail(input.email);
      const existing = specialistOf(user.id);
      const s: Specialist = {
        id: existing?.id ?? randomUUID(),
        userId: user.id,
        email: user.email,
        displayName: input.displayName,
        languages: [...new Set(input.languages)],
        isActive: input.isActive ?? existing?.isActive ?? true,
      };
      specialists.set(s.id, s);
      return s;
    },
    async updateSpecialist(id, patch) {
      const s = specialists.get(id);
      if (!s) return null;
      const next = { ...s, ...(patch.displayName ? { displayName: patch.displayName } : {}), ...(patch.languages ? { languages: [...new Set(patch.languages)] } : {}), ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }) };
      specialists.set(id, next);
      return next;
    },
    async grantRole(email, role) {
      const user = userByEmail(email);
      if (!roles.has(user.id)) roles.set(user.id, new Set());
      roles.get(user.id)!.add(role);
      return user;
    },
  };
  return store;
}
