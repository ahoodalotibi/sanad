import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accountsRouter } from '../../server/accounts/http.ts';
import { createMemoryAccountsStore } from '../../server/accounts/memoryStore.ts';
import { directionOf, toHandoffReason } from '../../server/accounts/types.ts';

const asker = { id: '11111111-1111-4111-8111-111111111111', email: 'asker@example.com' };
const other = { id: '22222222-2222-4222-8222-222222222222', email: 'other@example.com' };
const admin = { id: '33333333-3333-4333-8333-333333333333', email: 'admin@example.com' };
const urduDaee = { id: '44444444-4444-4444-8444-444444444444', email: 'urdu@example.com' };
const frDaee = { id: '55555555-5555-4555-8555-555555555555', email: 'fr@example.com' };

const store = createMemoryAccountsStore({ tokens: { asker, other, admin, urdu: urduDaee, fr: frDaee } });
let base = '';
let server: ReturnType<express.Express['listen']>;

beforeAll(async () => {
  await store.grantRole(admin.email, 'admin');
  const app = express();
  app.use(express.json());
  app.use('/api', accountsRouter({ store, publicConfig: { url: 'https://x.supabase.co', publishableKey: 'sb_publishable_test' }, log: () => {} }));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('accounts & referrals', () => {
  it('exposes only the public sign-in config without a session', async () => {
    expect((await call('GET', '/auth/config')).body).toEqual({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_test' });
    expect((await call('GET', '/my/referrals')).status).toBe(401);
    expect((await call('GET', '/my/referrals', 'forged')).status).toBe(401);
  });

  it('runs the whole journey: ask → daee in that language takes it → answer appears in «أسئلتي»', async () => {
    // admin adds two daees
    expect((await call('POST', '/admin/daees', 'asker', { email: 'x@y.co', displayName: 'X', languages: ['ur'] })).status).toBe(403);
    const ur = await call('POST', '/admin/daees', 'admin', { email: urduDaee.email, displayName: 'الشيخ أحمد', languages: ['ur', 'ar'] });
    expect(ur.status).toBe(201);
    await call('POST', '/admin/daees', 'admin', { email: frDaee.email, displayName: 'Imam Karim', languages: ['fr'] });
    expect((await call('GET', '/admin/daees', 'admin')).body.items).toHaveLength(2);

    // the asker sends an Urdu personal question
    const sent = await call('POST', '/referrals', 'asker', { question: 'میرا سوال', language: 'ur', reason: 'personal_case', context: 'پہلا پیغام' });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ status: 'pending', language: 'ur', response: null });
    expect(sent.body.reference).toMatch(/^SND-\d{6}$/);

    // only the Urdu daee sees it; the asker's identity is never included
    const frQueue = await call('GET', '/daee/queue', 'fr');
    expect(frQueue.body.items).toHaveLength(0);
    const urQueue = await call('GET', '/daee/queue', 'urdu');
    expect(urQueue.body.items).toHaveLength(1);
    expect(JSON.stringify(urQueue.body)).not.toContain(asker.email);
    expect(JSON.stringify(urQueue.body)).not.toContain(asker.id);
    expect(urQueue.body.items[0].question).toContain('پہلا پیغام');

    // a non-daee and a daee of another language cannot act on it
    expect((await call('POST', `/daee/referrals/${sent.body.id}/claim`, 'asker')).status).toBe(403);
    expect((await call('POST', `/daee/referrals/${sent.body.id}/claim`, 'fr')).status).toBe(409);

    // the Urdu daee takes it, and nobody else can take it after that
    expect((await call('POST', `/daee/referrals/${sent.body.id}/claim`, 'urdu')).body).toMatchObject({ status: 'assigned', assignedToMe: true });
    expect((await call('POST', `/daee/referrals/${sent.body.id}/claim`, 'urdu')).status).toBe(409);
    expect((await call('POST', `/my/referrals/${sent.body.id}/cancel`, 'asker')).status).toBe(409);

    // the asker cannot see a reply before it is answered
    let mine = await call('GET', '/my/referrals', 'asker');
    expect(mine.body.items[0]).toMatchObject({ status: 'assigned', response: null, daeeName: 'الشيخ أحمد' });

    expect((await call('POST', `/daee/referrals/${sent.body.id}/answer`, 'urdu', { response: '' })).status).toBe(400);
    expect((await call('POST', `/daee/referrals/${sent.body.id}/answer`, 'urdu', { response: 'جواب' })).body.status).toBe('answered');

    mine = await call('GET', '/my/referrals', 'asker');
    expect(mine.body.items[0]).toMatchObject({ status: 'answered', response: 'جواب' });
    expect(mine.body.items[0].answeredAt).toBeTruthy();

    // another user never sees it
    expect((await call('GET', '/my/referrals', 'other')).body.items).toHaveLength(0);
  });

  it('lets a daee give a question back and the asker cancel an untaken one', async () => {
    const q = await call('POST', '/referrals', 'other', { question: 'Question', language: 'fr' });
    await call('POST', `/daee/referrals/${q.body.id}/claim`, 'fr');
    expect((await call('POST', `/daee/referrals/${q.body.id}/release`, 'fr')).body.status).toBe('pending');
    expect((await call('POST', `/my/referrals/${q.body.id}/cancel`, 'asker')).status).toBe(409); // not theirs
    expect((await call('POST', `/my/referrals/${q.body.id}/cancel`, 'other')).body.status).toBe('cancelled');
    expect((await call('GET', '/daee/queue', 'fr')).body.items).toHaveLength(0);
  });

  it('a deactivated daee loses access; languages can be changed', async () => {
    const list = (await call('GET', '/admin/daees', 'admin')).body.items as Array<{ id: string; email: string }>;
    const fr = list.find((d) => d.email === frDaee.email)!;
    expect((await call('PATCH', `/admin/daees/${fr.id}`, 'admin', { languages: ['fr', 'id'] })).body.languages).toEqual(['fr', 'id']);
    await call('PATCH', `/admin/daees/${fr.id}`, 'admin', { isActive: false });
    expect((await call('GET', '/daee/queue', 'fr')).status).toBe(403);
  });

  it('validates input', async () => {
    expect((await call('POST', '/referrals', 'asker', { question: '', language: 'ur' })).status).toBe(400);
    expect((await call('POST', '/referrals', 'asker', { question: 'q', language: 'not a code' })).status).toBe(400);
    expect((await call('POST', '/my/referrals/not-a-uuid/cancel', 'asker')).status).toBe(400);
    expect((await call('POST', '/admin/daees', 'admin', { email: 'bad', displayName: 'x', languages: ['ur'] })).status).toBe(400);
  });

  it('maps reasons and directions', () => {
    expect(toHandoffReason('personal_case')).toBe('personal_fatwa');
    expect(toHandoffReason('not_found')).toBe('low_confidence');
    expect(toHandoffReason(undefined)).toBe('low_confidence');
    expect(directionOf('ur')).toBe('rtl');
    expect(directionOf('bn')).toBe('ltr');
  });
});
