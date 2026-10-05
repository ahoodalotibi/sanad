/**
 * SANAD Full-Stack Express Server with Vite Middleware
 * Serves the Sanad answer API (/api/ask, /api/meta), health checks, and the frontend
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { askHandler, createAnswerService, metaHandler } from './server/answer/http.ts';
import { getServiceClient, isSupabaseConfigured, pingDatabase } from './server/db/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '32kb' }));

// Answer path: approved corpus + optional model (classification and selection only)
const answerService = createAnswerService();

// Server health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SANAD Knowledge Engine',
    supabaseConfigured: isSupabaseConfigured(),
    corpusLoaded: !!answerService.corpus,
    modelConfigured: !!answerService.llm
  });
});

// Database connectivity check (Supabase, server-side secret key; never exposed to the browser)
app.get('/api/health/db', async (req, res) => {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ ok: false, error: 'Supabase environment variables are not set' });
  }
  try {
    const health = await pingDatabase(getServiceClient());
    return res.status(health.ok ? 200 : 503).json(health);
  } catch (error: any) {
    return res.status(503).json({ ok: false, error: error?.message ?? 'unknown error' });
  }
});

// Question answering: approved corpus (validated content from the reference sources) + optional model
// for understanding and selection only. No religious text is ever generated.
app.get('/api/meta', metaHandler(answerService));
app.post('/api/ask', askHandler(answerService));

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SANAD Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
