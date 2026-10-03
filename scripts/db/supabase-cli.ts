/**
 * Runs the Supabase CLI with values from `.env`, so secrets never appear in
 * package.json, shell history or chat.
 *
 *   npm run db:link        → supabase link --project-ref $SUPABASE_PROJECT_REF
 *   npm run db:push:dry    → shows which migrations would be applied
 *   npm run db:push        → applies supabase/migrations to the linked project
 *   npm run db:types       → regenerates server/db/database.types.ts from the linked project
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const command = process.argv[2];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✗ ${name} is not set. Add it to your local .env (see .env.example).`);
    process.exit(1);
  }
  return value;
}

function supabase(args: string[], capture = false) {
  const result = spawnSync('npx', ['supabase', ...args], {
    cwd: root,
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32', // npx is npx.cmd on Windows
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

switch (command) {
  case 'link':
    supabase(['link', '--project-ref', requireEnv('SUPABASE_PROJECT_REF'), '--password', requireEnv('SUPABASE_DB_PASSWORD')]);
    break;
  case 'push':
    supabase(['db', 'push', '--password', requireEnv('SUPABASE_DB_PASSWORD')]);
    break;
  case 'push:dry':
    supabase(['db', 'push', '--dry-run', '--password', requireEnv('SUPABASE_DB_PASSWORD')]);
    break;
  case 'types': {
    const out = supabase(['gen', 'types', 'typescript', '--linked', '--schema', 'public'], true);
    writeFileSync(path.join(root, 'server/db/database.types.ts'), out);
    console.log('✓ server/db/database.types.ts regenerated');
    break;
  }
  case 'types:local': {
    const out = supabase(['gen', 'types', 'typescript', '--db-url', requireEnv('DATABASE_URL'), '--schema', 'public'], true);
    writeFileSync(path.join(root, 'server/db/database.types.ts'), out);
    console.log('✓ server/db/database.types.ts regenerated from DATABASE_URL');
    break;
  }
  default:
    console.error('Usage: tsx scripts/db/supabase-cli.ts <link|push|push:dry|types|types:local>');
    process.exit(1);
}
