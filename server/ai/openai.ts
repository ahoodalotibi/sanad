/**
 * OpenAI implementation of the AI layer — SERVER ONLY.
 *  - Chat: Responses API with Structured Outputs (json_schema, strict)
 *  - Embeddings: embeddings API with an explicit `dimensions` matching the database (1536)
 * The API key is read from OPENAI_API_KEY on the server and never sent to the browser.
 * `store: false` so questions are not retained for later retrieval by OpenAI's stored-responses feature.
 */
import OpenAI from 'openai';
import { AiProviderError, type AiProvider, type GenerateJsonRequest } from './provider.ts';

export interface OpenAiSettings {
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  temperature?: number;
  timeoutMs: number;
  /** For tests only: inject a fetch implementation / base URL. */
  fetch?: typeof fetch;
  baseURL?: string;
}

if (typeof window !== 'undefined') {
  throw new Error('server/ai must never be imported into browser code (it handles OPENAI_API_KEY).');
}

export class OpenAiProvider implements AiProvider {
  readonly chatModel: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  private readonly client: OpenAI;
  private readonly temperature?: number;

  constructor(settings: OpenAiSettings) {
    this.chatModel = settings.chatModel;
    this.embeddingModel = settings.embeddingModel;
    this.embeddingDimensions = settings.embeddingDimensions;
    this.temperature = settings.temperature;
    this.client = new OpenAI({
      apiKey: settings.apiKey,
      timeout: settings.timeoutMs,
      maxRetries: 2,
      ...(settings.fetch ? { fetch: settings.fetch } : {}),
      ...(settings.baseURL ? { baseURL: settings.baseURL } : {}),
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const res = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts,
        dimensions: this.embeddingDimensions,
        encoding_format: 'float',
      });
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      for (const v of vectors) {
        if (v.length !== this.embeddingDimensions) {
          throw new AiProviderError(`Embedding has ${v.length} dimensions, expected ${this.embeddingDimensions}`);
        }
      }
      return vectors;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(`Embedding request failed: ${describe(err)}`, err);
    }
  }

  async generateJson<T>(request: GenerateJsonRequest): Promise<T> {
    let text: string;
    try {
      const res = await this.client.responses.create({
        model: this.chatModel,
        instructions: request.system,
        input: request.user,
        store: false,
        ...(this.temperature !== undefined ? { temperature: this.temperature } : {}),
        ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
        text: {
          format: { type: 'json_schema', name: request.schema.name, schema: request.schema.schema, strict: true },
        },
      });
      if (res.status && res.status !== 'completed') {
        throw new AiProviderError(`Model response not completed (status: ${res.status})`);
      }
      text = res.output_text;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;
      throw new AiProviderError(`Generation request failed: ${describe(err)}`, err);
    }
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new AiProviderError('Model returned invalid JSON', err);
    }
  }
}

function describe(err: unknown): string {
  if (err instanceof OpenAI.APIError) return `${err.status ?? ''} ${err.name}`.trim();
  return err instanceof Error ? err.message : String(err);
}
