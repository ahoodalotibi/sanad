/**
 * Make someone an admin of Sanad (the admin can then add daees from the admin page).
 *
 *   npm run admin:grant -- --email=name@example.com
 *
 * Creates the account if it does not exist yet (they sign in later with an email code).
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env. Prints no keys.
 */
import 'dotenv/config';
import { createSupabaseAccountsStore } from '../../server/accounts/supabaseStore.ts';
import { readSupabaseEnv } from '../../server/db/env.ts';
import { parseArgs } from '../ingest/lib/cli.ts';

const args = parseArgs(process.argv.slice(2));
const email = String(args.email ?? '').trim();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run admin:grant -- --email=name@example.com');
  process.exit(1);
}
try {
  const env = readSupabaseEnv();
  const store = createSupabaseAccountsStore(env.url, env.secretKey);
  await store.grantRole(email, 'admin');
  console.log(`✓ ${email} is now an admin`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
