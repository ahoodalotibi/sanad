/**
 * AccountsStore on Supabase (server-side key). Every rule is enforced in the query itself
 * (e.g. a claim only succeeds on a pending question in one of the daee's languages), so two
 * daees cannot take the same question and nobody can act outside their role.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AccountsStore, AuthUser, MyReferral, QueueItem, Role, Specialist, SpecialistInput } from './types.ts';
import { directionOf, languageNames } from './types.ts';

const REF_COLS = 'id, reference_code, requester_user_id, question, context, language, reason, status, assigned_specialist_id, specialist_response, created_at, resolved_at';

interface RefRow {
  id: string;
  reference_code: string;
  requester_user_id: string | null;
  question: string;
  context: string | null;
  language: string;
  reason: QueueItem['reason'];
  status: QueueItem['status'];
  assigned_specialist_id: string | null;
  specialist_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

function fail(where: string, error: { message: string } | null): never {
  throw new Error(`${where}: ${error?.message ?? 'unknown error'}`);
}

export function createSupabaseAccountsStore(url: string, secretKey: string): AccountsStore {
  const db: SupabaseClient = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const knownLanguages = new Set<string>();

  async function specialistNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const { data, error } = await db.from('specialists').select('id, display_name').in('id', unique);
    if (error) fail('specialists.names', error);
    return new Map((data ?? []).map((r) => [r.id as string, r.display_name as string]));
  }

  async function toMine(rows: RefRow[]): Promise<MyReferral[]> {
    const names = await specialistNames(rows.map((r) => r.assigned_specialist_id ?? ''));
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference_code,
      question: r.question,
      language: r.language,
      status: r.status,
      response: r.status === 'answered' || r.status === 'closed' ? r.specialist_response : null,
      daeeName: r.assigned_specialist_id ? names.get(r.assigned_specialist_id) ?? null : null,
      createdAt: r.created_at,
      answeredAt: r.status === 'answered' ? r.resolved_at : null,
    }));
  }

  const toQueue = (r: RefRow, s: Specialist): QueueItem => ({
    id: r.id,
    reference: r.reference_code,
    question: r.context ? `${r.context}\n—\n${r.question}` : r.question,
    language: r.language,
    reason: r.reason,
    status: r.status,
    response: r.specialist_response,
    createdAt: r.created_at,
    assignedToMe: r.assigned_specialist_id === s.id,
  });

  async function findUserByEmail(email: string): Promise<AuthUser | null> {
    const target = email.toLowerCase();
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) fail('auth.listUsers', error);
      const hit = data.users.find((u) => u.email?.toLowerCase() === target);
      if (hit) return { id: hit.id, email: hit.email ?? null };
      if (data.users.length < 1000) return null;
    }
    return null;
  }

  async function userForEmail(email: string): Promise<AuthUser> {
    const existing = await findUserByEmail(email);
    if (existing) return existing;
    const { data, error } = await db.auth.admin.createUser({ email: email.toLowerCase(), email_confirm: true });
    if (error || !data.user) fail('auth.createUser', error);
    return { id: data.user.id, email: data.user.email ?? null };
  }

  async function loadSpecialists(filter?: { userId?: string; id?: string }): Promise<Specialist[]> {
    let q = db.from('specialists').select('id, user_id, display_name, is_active, specialist_languages(language)');
    if (filter?.userId) q = q.eq('user_id', filter.userId);
    if (filter?.id) q = q.eq('id', filter.id);
    const { data, error } = await q.order('created_at');
    if (error) fail('specialists.list', error);
    const out: Specialist[] = [];
    for (const r of data ?? []) {
      let email: string | null = null;
      if (!filter?.userId) {
        const u = await db.auth.admin.getUserById(r.user_id as string);
        email = u.data.user?.email ?? null;
      }
      out.push({
        id: r.id as string,
        userId: r.user_id as string,
        email,
        displayName: r.display_name as string,
        isActive: r.is_active as boolean,
        languages: ((r.specialist_languages as Array<{ language: string }>) ?? []).map((l) => l.language),
      });
    }
    return out;
  }

  async function setLanguages(specialistId: string, langs: string[]) {
    for (const l of langs) await store.ensureLanguage(l);
    const { error: delErr } = await db.from('specialist_languages').delete().eq('specialist_id', specialistId);
    if (delErr) fail('specialist_languages.delete', delErr);
    if (langs.length) {
      const { error } = await db.from('specialist_languages').insert([...new Set(langs)].map((language) => ({ specialist_id: specialistId, language })));
      if (error) fail('specialist_languages.insert', error);
    }
  }

  const store: AccountsStore = {
    async verifyToken(token) {
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? null };
    },

    async getProfile(userId) {
      const { data, error } = await db.from('user_roles').select('role').eq('user_id', userId);
      if (error) fail('user_roles.select', error);
      const [specialist] = await loadSpecialists({ userId });
      return { roles: (data ?? []).map((r) => r.role as Role), specialist: specialist ?? null };
    },

    async ensureLanguage(code) {
      if (knownLanguages.has(code)) return;
      const { data, error } = await db.from('languages').select('code').eq('code', code).maybeSingle();
      if (error) fail('languages.select', error);
      if (!data) {
        const names = languageNames(code);
        const { error: insErr } = await db
          .from('languages')
          .upsert({ code, name_en: names.nameEn, native_name: names.native, direction: directionOf(code) }, { onConflict: 'code', ignoreDuplicates: true });
        if (insErr) fail('languages.insert', insErr);
      }
      knownLanguages.add(code);
    },

    async createReferral(input) {
      await store.ensureLanguage(input.language);
      const { data, error } = await db
        .from('handoff_requests')
        .insert({ requester_user_id: input.userId, question: input.question, context: input.context, language: input.language, reason: input.reason })
        .select(REF_COLS)
        .single();
      if (error) fail('handoff_requests.insert', error);
      return (await toMine([data as RefRow]))[0];
    },

    async listMyReferrals(userId) {
      const { data, error } = await db.from('handoff_requests').select(REF_COLS).eq('requester_user_id', userId).order('created_at', { ascending: false }).limit(100);
      if (error) fail('handoff_requests.mine', error);
      return toMine((data ?? []) as RefRow[]);
    },

    async cancelReferral(userId, id) {
      const { data, error } = await db
        .from('handoff_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('requester_user_id', userId)
        .eq('status', 'pending')
        .select(REF_COLS)
        .maybeSingle();
      if (error) fail('handoff_requests.cancel', error);
      return data ? (await toMine([data as RefRow]))[0] : null;
    },

    async listQueue(s) {
      const open = s.languages.length
        ? await db.from('handoff_requests').select(REF_COLS).eq('status', 'pending').in('language', s.languages).order('created_at').limit(200)
        : { data: [], error: null };
      if (open.error) fail('queue.open', open.error);
      const mine = await db.from('handoff_requests').select(REF_COLS).eq('assigned_specialist_id', s.id).in('status', ['assigned', 'in_review', 'answered']).order('created_at').limit(200);
      if (mine.error) fail('queue.mine', mine.error);
      return [...(open.data ?? []), ...(mine.data ?? [])].map((r) => toQueue(r as RefRow, s));
    },

    async claim(s, id) {
      if (!s.languages.length) return null;
      const { data, error } = await db
        .from('handoff_requests')
        .update({ assigned_specialist_id: s.id, status: 'assigned' })
        .eq('id', id)
        .eq('status', 'pending')
        .in('language', s.languages)
        .select(REF_COLS)
        .maybeSingle();
      if (error) fail('queue.claim', error);
      return data ? toQueue(data as RefRow, s) : null;
    },

    async release(s, id) {
      const { data, error } = await db
        .from('handoff_requests')
        .update({ assigned_specialist_id: null, status: 'pending' })
        .eq('id', id)
        .eq('assigned_specialist_id', s.id)
        .in('status', ['assigned', 'in_review'])
        .select(REF_COLS)
        .maybeSingle();
      if (error) fail('queue.release', error);
      return data ? toQueue(data as RefRow, s) : null;
    },

    async answer(s, id, response) {
      const { data, error } = await db
        .from('handoff_requests')
        .update({ status: 'answered', specialist_response: response })
        .eq('id', id)
        .eq('assigned_specialist_id', s.id)
        .in('status', ['assigned', 'in_review'])
        .select(REF_COLS)
        .maybeSingle();
      if (error) fail('queue.answer', error);
      return data ? toQueue(data as RefRow, s) : null;
    },

    async listSpecialists() {
      return loadSpecialists();
    },

    async upsertSpecialist(input: SpecialistInput) {
      const user = await userForEmail(input.email);
      const { data, error } = await db
        .from('specialists')
        .upsert({ user_id: user.id, display_name: input.displayName, ...(input.isActive === undefined ? {} : { is_active: input.isActive }) }, { onConflict: 'user_id' })
        .select('id')
        .single();
      if (error) fail('specialists.upsert', error);
      await setLanguages(data.id as string, input.languages);
      const [s] = await loadSpecialists({ id: data.id as string });
      return s;
    },

    async updateSpecialist(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.displayName) row.display_name = patch.displayName;
      if (patch.isActive !== undefined) row.is_active = patch.isActive;
      if (Object.keys(row).length) {
        const { error } = await db.from('specialists').update(row).eq('id', id);
        if (error) fail('specialists.update', error);
      }
      if (patch.languages) await setLanguages(id, patch.languages);
      const [s] = await loadSpecialists({ id });
      return s ?? null;
    },

    async grantRole(email, role) {
      const user = await userForEmail(email);
      const { error } = await db.from('user_roles').upsert({ user_id: user.id, role }, { onConflict: 'user_id,role', ignoreDuplicates: true });
      if (error) fail('user_roles.upsert', error);
      return user;
    },
  };
  return store;
}
