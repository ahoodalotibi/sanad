/**
 * OpenAI provider (through an injected fetch — no network) and the /api/ask handler.
 */
import { describe, expect, it } from 'vitest';
import { createAskHandler, createRateLimiter } from '../../server/api/ask.ts';
import { OpenAiProvider } from '../../server/ai/openai.ts';
import { AiProviderError } from '../../server/ai/provider.ts';
import { DEFAULT_RAG_SETTINGS } from '../../server/rag/config.ts';
import type { RagDeps } from '../../server/rag/pipeline.ts';
import { FakeAi } from '../helpers/fakeAi.ts';
import { MemoryStore, testChunk } from '../helpers/memoryStore.ts';

type Call = { url: string; headers: Record<string, string>; body: any };

function fakeOpenAi(reply: (call: Call) => unknown) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const call = { url, headers, body: init?.body ? JSON.parse(init.body) : null };
    calls.push(call);
    return new Response(JSON.stringify(reply(call)), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const responseBody = (text: string) => ({
  id: 'resp_test',
  object: 'response',
  created_at: 0,
  status: 'completed',
  model: 'test-model',
  output: [{ type: 'message', id: 'msg_test', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] }],
});

const provider = (fetchImpl: typeof fetch) =>
  new OpenAiProvider({ apiKey: 'sk-test-not-real', chatModel: 'model-from-env', embeddingModel: 'embed-from-env', embeddingDimensions: 1536, timeoutMs: 5000, fetch: fetchImpl, baseURL: 'https://openai.test/v1' });

describe('OpenAiProvider', () => {
  it('calls the Responses API with the env model, strict JSON schema and store:false', async () => {
    const { calls, fetchImpl } = fakeOpenAi(() => responseBody('{"ok":true}'));
    const out = await provider(fetchImpl).generateJson<{ ok: boolean }>({
      system: 'SYSTEM RULES',
      user: '<question>\nq\n</question>',
      schema: { name: 'test_schema', schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } } },
    });
    expect(out).toEqual({ ok: true });
    const call = calls[0];
    expect(call.url).toBe('https://openai.test/v1/responses');
    expect(call.headers.authorization).toBe('Bearer sk-test-not-real');
    expect(call.body).toMatchObject({
      model: 'model-from-env',
      instructions: 'SYSTEM RULES',
      input: '<question>\nq\n</question>',
      store: false,
      text: { format: { type: 'json_schema', name: 'test_schema', strict: true } },
    });
    expect(JSON.stringify(call.body)).not.toContain('sk-test-not-real'); // key only in the header
    expect(call.body).not.toHaveProperty('temperature');
  });

  it('requests 1536-dimension embeddings from the configured embedding model', async () => {
    const { calls, fetchImpl } = fakeOpenAi(() => ({
      object: 'list',
      model: 'embed-from-env',
      data: [
        { object: 'embedding', index: 1, embedding: new Array(1536).fill(0.2) },
        { object: 'embedding', index: 0, embedding: new Array(1536).fill(0.1) },
      ],
      usage: { prompt_tokens: 2, total_tokens: 2 },
    }));
    const vectors = await provider(fetchImpl).embed(['a', 'b']);
    expect(calls[0].url).toBe('https://openai.test/v1/embeddings');
    expect(calls[0].body).toMatchObject({ model: 'embed-from-env', dimensions: 1536, input: ['a', 'b'] });
    expect(vectors[0][0]).toBe(0.1); // re-ordered by index
  });

  it('rejects wrong embedding sizes and non-JSON model output', async () => {
    const small = fakeOpenAi(() => ({ object: 'list', model: 'x', data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }], usage: {} }));
    await expect(provider(small.fetchImpl).embed(['a'])).rejects.toThrow(/expected 1536/);
    const bad = fakeOpenAi(() => responseBody('not json'));
    await expect(
      provider(bad.fetchImpl).generateJson({ system: 's', user: 'u', schema: { name: 'n', schema: {} } })
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  return res;
}
const req = (body: unknown, ip = '1.1.1.1') => ({ body, ip }) as any;

describe('POST /api/ask handler', () => {
  const deps = (): RagDeps => ({ ai: new FakeAi(), store: new MemoryStore([testChunk({ id: 'c1' })]), settings: DEFAULT_RAG_SETTINGS, includeTestData: true });

  it('returns 503 RAG_NOT_CONFIGURED when OpenAI/Supabase are not set up', async () => {
    const res = mockRes();
    await createAskHandler(() => null)(req({ question: 'q', language: 'en' }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ code: 'RAG_NOT_CONFIGURED' });
  });

  it('validates input and enforces the question length limit', async () => {
    const h = createAskHandler(deps);
    const bad = mockRes();
    await h(req({ question: 'q', language: 'fr' }), bad);
    expect(bad.statusCode).toBe(400);
    const long = mockRes();
    await h(req({ question: 'x'.repeat(1500), language: 'en' }), long);
    expect(long.body).toEqual({ code: 'QUESTION_TOO_LONG' });
  });

  it('answers through the pipeline', async () => {
    const res = mockRes();
    await createAskHandler(deps)(req({ question: 'TEST question', language: 'en' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ engine: 'rag', citations: [expect.objectContaining({ sourceName: 'TEST source (مصدر تجريبي)' })] });
  });

  it('never leaks internal error details', async () => {
    const failing: RagDeps = { ...deps(), store: { search: async () => { throw new Error('connection string postgres://secret'); }, getScripture: async () => [] } };
    const res = mockRes();
    await createAskHandler(() => failing, { log: () => {} })(req({ question: 'q', language: 'en' }), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('rate-limits per client', async () => {
    let t = 0;
    const limiter = createRateLimiter(2, 1000, () => t);
    expect([limiter('a'), limiter('a'), limiter('a'), limiter('b')]).toEqual([true, true, false, true]);
    t = 1001;
    expect(limiter('a')).toBe(true);
    const res = mockRes();
    await createAskHandler(deps, { limiter: () => false })(req({ question: 'q', language: 'en' }), res);
    expect(res.statusCode).toBe(429);
  });
});
