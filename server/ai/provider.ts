/**
 * The AI layer as seen by the RAG pipeline. The production implementation is
 * OpenAI (server/ai/openai.ts); tests use a deterministic fake. Keeping this
 * interface small makes the pipeline testable without network access.
 */
export interface JsonSchemaSpec {
  /** a-z, A-Z, 0-9, _ and - only */
  name: string;
  /** JSON Schema (strict subset: every property required, additionalProperties false) */
  schema: Record<string, unknown>;
}

export interface GenerateJsonRequest {
  /** Developer/system instructions — never contains user or retrieved text. */
  system: string;
  /** User-turn content: question and retrieved sources, already wrapped as data. */
  user: string;
  schema: JsonSchemaSpec;
  maxOutputTokens?: number;
}

export interface AiProvider {
  readonly chatModel: string;
  readonly embeddingModel: string;
  readonly embeddingDimensions: number;
  embed(texts: string[]): Promise<number[][]>;
  generateJson<T>(request: GenerateJsonRequest): Promise<T>;
}

export class AiProviderError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AiProviderError';
  }
}
