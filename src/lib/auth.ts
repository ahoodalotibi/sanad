/**
 * Email one-time-code sign-in (Supabase Auth). The browser only ever holds the public
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
      .then((c) => createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sanad-auth' } }))
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
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
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
