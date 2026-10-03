import { createHash } from 'node:crypto';
import type { SanadDbClient } from '../client.ts';
import { DbError, check, unwrap, unwrapMaybe } from '../errors.ts';
import type { Conversation, LanguageCode, Message, MessageSource, TablesInsert } from '../types.ts';

/** Privacy: only a SHA-256 of the client's random session id is ever stored. */
export function hashSessionId(sessionId: string): string {
  if (sessionId.trim().length < 16) throw new RangeError('anonymous session id must be at least 16 characters');
  return createHash('sha256').update(sessionId).digest('hex');
}

export type NewConversation =
  | { userId: string; language: LanguageCode; title?: string }
  | { anonymousSessionId: string; language: LanguageCode; title?: string };

export type AssistantMessageInput = Omit<TablesInsert<'messages'>, 'id' | 'role' | 'conversation_id' | 'created_at'>;
export type MessageSourceInput = Omit<TablesInsert<'message_sources'>, 'id' | 'message_id' | 'created_at'>;

export function createConversationsRepository(db: SanadDbClient) {
  return {
    async create(input: NewConversation): Promise<Conversation> {
      const row: TablesInsert<'conversations'> =
        'userId' in input
          ? { user_id: input.userId, language: input.language, title: input.title ?? null }
          : { anonymous_session_hash: hashSessionId(input.anonymousSessionId), language: input.language, title: input.title ?? null };
      return unwrap('conversations.create', await db.from('conversations').insert(row).select('*').single());
    },

    async getById(id: string): Promise<Conversation | null> {
      return unwrapMaybe('conversations.getById', await db.from('conversations').select('*').eq('id', id).maybeSingle());
    },

    /** Confirms an anonymous visitor owns a conversation (server-side check before continuing it). */
    async getForAnonymousSession(id: string, sessionId: string): Promise<Conversation | null> {
      return unwrapMaybe(
        'conversations.getForAnonymousSession',
        await db
          .from('conversations')
          .select('*')
          .eq('id', id)
          .eq('anonymous_session_hash', hashSessionId(sessionId))
          .maybeSingle()
      );
    },

    async listForUser(userId: string, limit = 20): Promise<Conversation[]> {
      return unwrap(
        'conversations.listForUser',
        await db
          .from('conversations')
          .select('*')
          .eq('user_id', userId)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(limit)
      );
    },

    /** Privacy retention job: removes conversations past expires_at (messages cascade). */
    async purgeExpired(now: Date = new Date()): Promise<number> {
      const data = unwrap(
        'conversations.purgeExpired',
        await db.from('conversations').delete().lt('expires_at', now.toISOString()).select('id')
      );
      return data.length;
    },
  };
}

export function createMessagesRepository(db: SanadDbClient) {
  return {
    async addUserMessage(input: {
      conversationId: string;
      content: string;
      language: LanguageCode;
      inputMode?: 'text' | 'voice';
    }): Promise<Message> {
      return unwrap(
        'messages.addUserMessage',
        await db
          .from('messages')
          .insert({
            conversation_id: input.conversationId,
            role: 'user',
            content: input.content,
            language: input.language,
            input_mode: input.inputMode ?? 'text',
          })
          .select('*')
          .single()
      );
    },

    /**
     * Stores an assistant answer together with the sources it retrieved/cited.
     * If saving the sources fails, the message is removed so no answer is ever stored without its provenance.
     */
    async addAssistantMessage(conversationId: string, message: AssistantMessageInput, sources: MessageSourceInput[] = []): Promise<Message> {
      const saved = unwrap(
        'messages.addAssistantMessage',
        await db
          .from('messages')
          .insert({ ...message, conversation_id: conversationId, role: 'assistant' })
          .select('*')
          .single()
      );

      if (sources.length > 0) {
        const { error } = await db.from('message_sources').insert(sources.map((s) => ({ ...s, message_id: saved.id })));
        if (error) {
          await db.from('messages').delete().eq('id', saved.id);
          throw new DbError('messages.addAssistantMessage(sources)', error);
        }
      }
      return saved;
    },

    async listByConversation(conversationId: string, limit = 50): Promise<Message[]> {
      return unwrap(
        'messages.listByConversation',
        await db.from('messages').select('*').eq('conversation_id', conversationId).order('created_at').limit(limit)
      );
    },

    async getSources(messageId: string): Promise<MessageSource[]> {
      return unwrap(
        'messages.getSources',
        await db.from('message_sources').select('*').eq('message_id', messageId).order('kind').order('rank')
      );
    },

    async delete(messageId: string): Promise<void> {
      check('messages.delete', await db.from('messages').delete().eq('id', messageId));
    },
  };
}
