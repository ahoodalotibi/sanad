/**
 * HTTP routes for accounts, «أسئلتي», the association portal and admin.
 *
 *   GET  /api/auth/config                     public Supabase URL + publishable key (for email-code sign-in)
 *   GET  /api/me                              roles + daee profile of the signed-in user
 *
 *   POST /api/referrals                       { question, language, reason?, context? } → send to a daee
 *   GET  /api/my/referrals                    the asker's questions and replies («أسئلتي»)
 *   POST /api/my/referrals/:id/cancel         cancel a question nobody has taken yet
 *
 *   GET  /api/daee/queue                      open questions in my languages + the ones I took
 *   POST /api/daee/referrals/:id/claim        take a question
 *   POST /api/daee/referrals/:id/release      give it back
 *   POST /api/daee/referrals/:id/answer       { response } → the asker sees it in «أسئلتي»
 *
 *   GET  /api/admin/daees                     list daees
 *   POST /api/admin/daees                     { email, displayName, languages[] } add or update a daee
 *   PATCH /api/admin/daees/:id                { displayName?, languages?, isActive? }
 *
 * Every route except /api/auth/config needs "Authorization: Bearer <Supabase access token>".
 */
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createRateLimiter } from '../answer/rateLimit.ts';
import { LANGUAGE_CODE, toHandoffReason, type AccountsStore, type AuthUser, type Profile, type Specialist } from './types.ts';

type Authed = Request & { user?: AuthUser; profile?: Profile };

const lang = z.string().trim().toLowerCase().regex(LANGUAGE_CODE);
const ReferralBody = z.object({
  question: z.string().trim().min(1).max(2000),
  language: lang,
  reason: z.enum(['personal_case', 'not_found', 'out_of_scope', 'unclear', 'user_request']).optional(),
  context: z.string().trim().max(4000).optional(),
});
const AnswerBody = z.object({ response: z.string().trim().min(1).max(8000) });
const DaeeBody = z.object({
  email: z.email().max(320),
  displayName: z.string().trim().min(1).max(120),
  languages: z.array(lang).min(1).max(30),
  isActive: z.boolean().optional(),
});
const DaeePatch = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  languages: z.array(lang).min(1).max(30).optional(),
  isActive: z.boolean().optional(),
});
const Id = z.uuid();

export interface AccountsRouterOptions {
  store: AccountsStore | null;
  publicConfig: { url: string; publishableKey: string } | null;
  log?: (msg: string) => void;
  /** referrals per user per hour */
  referralLimit?: number;
}

export function accountsRouter(opts: AccountsRouterOptions) {
  const router = express.Router();
  const log = opts.log ?? ((m: string) => console.error(m));
  const limiter = createRateLimiter(opts.referralLimit ?? 10, 60 * 60 * 1000);

  router.get('/auth/config', (_req, res) => {
    if (!opts.publicConfig) return res.status(503).json({ code: 'AUTH_NOT_CONFIGURED' });
    res.json(opts.publicConfig);
  });

  // Everything below needs a signed-in user.
  router.use(async (req: Authed, res, next) => {
    if (!opts.store) return res.status(503).json({ code: 'AUTH_NOT_CONFIGURED' });
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    if (!token) return res.status(401).json({ code: 'SIGN_IN_REQUIRED' });
    try {
      const user = await opts.store.verifyToken(token);
      if (!user) return res.status(401).json({ code: 'SIGN_IN_REQUIRED' });
      req.user = user;
      req.profile = await opts.store.getProfile(user.id);
      next();
    } catch (err) {
      log(`[accounts] auth failed: ${(err as Error).message}`);
      res.status(500).json({ code: 'ACCOUNTS_FAILED' });
    }
  });

  const store = () => opts.store!;
  const wrap = (fn: (req: Authed, res: Response) => Promise<unknown>) => (req: Authed, res: Response, _next: NextFunction) =>
    fn(req, res).catch((err) => {
      log(`[accounts] ${req.method} ${req.path} failed: ${(err as Error).message}`);
      if (!res.headersSent) res.status(500).json({ code: 'ACCOUNTS_FAILED' });
    });
  const activeDaee = (req: Authed): Specialist | null => (req.profile?.specialist?.isActive ? req.profile.specialist : null);
  const isAdmin = (req: Authed) => !!req.profile?.roles.includes('admin');

  router.get(
    '/me',
    wrap(async (req, res) => {
      res.json({ user: req.user, roles: req.profile!.roles, daee: req.profile!.specialist });
    })
  );

  // ---- asker -------------------------------------------------------------------------------------
  router.post(
    '/referrals',
    wrap(async (req, res) => {
      const body = ReferralBody.safeParse(req.body);
      if (!body.success) return res.status(400).json({ code: 'INVALID_REQUEST' });
      if (!limiter(req.user!.id)) return res.status(429).json({ code: 'RATE_LIMITED' });
      const referral = await store().createReferral({
        userId: req.user!.id,
        question: body.data.question,
        language: body.data.language,
        reason: toHandoffReason(body.data.reason),
        context: body.data.context || null,
      });
      res.status(201).json(referral);
    })
  );

  router.get(
    '/my/referrals',
    wrap(async (req, res) => {
      res.json({ items: await store().listMyReferrals(req.user!.id) });
    })
  );

  router.post(
    '/my/referrals/:id/cancel',
    wrap(async (req, res) => {
      const id = Id.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ code: 'INVALID_REQUEST' });
      const r = await store().cancelReferral(req.user!.id, id.data);
      if (!r) return res.status(409).json({ code: 'NOT_CANCELLABLE' });
      res.json(r);
    })
  );

  // ---- daee portal --------------------------------------------------------------------------------
  const daeeAction = (action: 'claim' | 'release' | 'answer') =>
    wrap(async (req, res) => {
      const s = activeDaee(req);
      if (!s) return res.status(403).json({ code: 'NOT_A_DAEE' });
      const id = Id.safeParse(req.params.id);
      if (!id.success) return res.status(400).json({ code: 'INVALID_REQUEST' });
      let item;
      if (action === 'answer') {
        const body = AnswerBody.safeParse(req.body);
        if (!body.success) return res.status(400).json({ code: 'INVALID_REQUEST' });
        item = await store().answer(s, id.data, body.data.response);
      } else {
        item = await store()[action](s, id.data);
      }
      if (!item) return res.status(409).json({ code: 'NOT_AVAILABLE' });
      res.json(item);
    });

  router.get(
    '/daee/queue',
    wrap(async (req, res) => {
      const s = activeDaee(req);
      if (!s) return res.status(403).json({ code: 'NOT_A_DAEE' });
      res.json({ daee: { displayName: s.displayName, languages: s.languages }, items: await store().listQueue(s) });
    })
  );
  router.post('/daee/referrals/:id/claim', daeeAction('claim'));
  router.post('/daee/referrals/:id/release', daeeAction('release'));
  router.post('/daee/referrals/:id/answer', daeeAction('answer'));

  // ---- admin --------------------------------------------------------------------------------------
  router.get(
    '/admin/daees',
    wrap(async (req, res) => {
      if (!isAdmin(req)) return res.status(403).json({ code: 'NOT_ADMIN' });
      res.json({ items: await store().listSpecialists() });
    })
  );
  router.post(
    '/admin/daees',
    wrap(async (req, res) => {
      if (!isAdmin(req)) return res.status(403).json({ code: 'NOT_ADMIN' });
      const body = DaeeBody.safeParse(req.body);
      if (!body.success) return res.status(400).json({ code: 'INVALID_REQUEST' });
      res.status(201).json(await store().upsertSpecialist(body.data));
    })
  );
  router.patch(
    '/admin/daees/:id',
    wrap(async (req, res) => {
      if (!isAdmin(req)) return res.status(403).json({ code: 'NOT_ADMIN' });
      const id = Id.safeParse(req.params.id);
      const body = DaeePatch.safeParse(req.body);
      if (!id.success || !body.success) return res.status(400).json({ code: 'INVALID_REQUEST' });
      const s = await store().updateSpecialist(id.data, body.data);
      if (!s) return res.status(404).json({ code: 'NOT_FOUND' });
      res.json(s);
    })
  );

  return router;
}
