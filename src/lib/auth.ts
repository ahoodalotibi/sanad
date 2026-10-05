/**
 * Passwordless email sign-in (Supabase Auth): the email carries a sign-in link, and also a code
 * when the project's email template includes one. Opening the link signs this browser in (PKCE). The browser only ever holds the public
 * (publishable) key, fetched from our server; every protected action goes through our server.
 */
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { api, setTokenProvider } from './api';

let client: Promise<SupabaseClient | null> | null = null;

export function getAuthClient(): Promise<SupabaseClient | null> {
  if (!client) {
    client = api
      .authConfig()
      .then((c) => createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'sanad-auth' } }))
      .catch(() => {
        client = null;
        return null;
      });
  }
  return client;
}

setTokenProvider(async () => {
  const c = await getAuthClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.access_token ?? null;
});

export async function sendCode(email: string): Promise<'ok' | 'unavailable' | 'error'> {
  const c = await getAuthClient();
  if (!c) return 'unavailable';
  const portal = window.location.hash.startsWith('#/portal');
  const emailRedirectTo = `${window.location.origin}/${portal ? '?to=portal' : '?to=my'}`;
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } });
  return error ? 'error' : 'ok';
}

export async function verifyCode(email: string, token: string): Promise<boolean> {
  const c = await getAuthClient();
  if (!c) return false;
  const { error } = await c.auth.verifyOtp({ email, token, type: 'email' });
  return !error;
}

export async function signOut() {
  const c = await getAuthClient();
  await c?.auth.signOut();
}

/** Current session (null while signed out); re-renders on sign-in / sign-out. */
export function useSession(): { session: Session | null; ready: boolean } {
  const [state, setState] = useState<{ session: Session | null; ready: boolean }>({ session: null, ready: false });
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    getAuthClient().then(async (c) => {
      if (!alive) return;
      if (!c) return setState({ session: null, ready: true });
      const { data } = await c.auth.getSession();
      if (alive) setState({ session: data.session, ready: true });
      const sub = c.auth.onAuthStateChange((_e, session) => alive && setState({ session, ready: true }));
      unsub = () => sub.data.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);
  return state;
}

/** After returning from the email link (?to=my / ?to=portal), go to the right page. */
export function routeAfterEmailLink() {
  if (typeof window === 'undefined') return;
  const to = new URLSearchParams(window.location.search).get('to');
  if (!to) return;
  const hash = to === 'portal' ? '#/portal' : '#/my';
  window.history.replaceState(null, '', window.location.pathname + window.location.search.replace(/[?&]to=[^&]*/, '').replace(/^&/, '?') + hash);
}

/** A referral the asker confirmed before signing in; sent once a session exists (in whichever tab). */
const PENDING = 'sanad-pending-referral';
export interface PendingReferral { question: string; language: string; reason?: string; context?: string }
export function savePending(r: PendingReferral) {
  try { window.localStorage.setItem(PENDING, JSON.stringify(r)); } catch { /* ignore */ }
}
export function takePending(): PendingReferral | null {
  try {
    const v = window.localStorage.getItem(PENDING);
    if (!v) return null;
    window.localStorage.removeItem(PENDING);
    return JSON.parse(v) as PendingReferral;
  } catch {
    return null;
  }
}
