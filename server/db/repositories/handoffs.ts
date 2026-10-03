import type { SanadDbClient } from '../client.ts';
import { DbError, unwrap, unwrapMaybe } from '../errors.ts';
import type { HandoffReason, HandoffRequest, HandoffStatus, LanguageCode, Tables } from '../types.ts';

export interface NewHandoff {
  question: string;
  language: LanguageCode;
  reason: HandoffReason;
  conversationId?: string | null;
  messageId?: string | null;
  requesterUserId?: string | null;
  aiSummary?: string | null;
  consultedChunkIds?: string[];
  /** Only stored when the user explicitly consented. */
  contact?: { channel: 'email' | 'phone' | 'in_app'; value: string; consent: true } | null;
}

export function createHandoffsRepository(db: SanadDbClient) {
  return {
    /** Creates a pending request plus the list of sources the system consulted before handing off. */
    async create(input: NewHandoff): Promise<HandoffRequest> {
      const created = unwrap(
        'handoffs.create',
        await db
          .from('handoff_requests')
          .insert({
            question: input.question,
            language: input.language,
            reason: input.reason,
            conversation_id: input.conversationId ?? null,
            message_id: input.messageId ?? null,
            requester_user_id: input.requesterUserId ?? null,
            ai_summary: input.aiSummary ?? null,
            contact_consent: input.contact?.consent ?? false,
            contact_channel: input.contact?.channel ?? null,
            contact_value: input.contact?.value ?? null,
          })
          .select('*')
          .single()
      );

      const chunkIds = [...new Set(input.consultedChunkIds ?? [])];
      if (chunkIds.length > 0) {
        const { error } = await db
          .from('handoff_consulted_sources')
          .insert(chunkIds.map((chunk_id) => ({ handoff_id: created.id, chunk_id })));
        if (error) {
          await db.from('handoff_requests').delete().eq('id', created.id);
          throw new DbError('handoffs.create(consulted sources)', error);
        }
      }
      return created;
    },

    async getByReference(referenceCode: string): Promise<HandoffRequest | null> {
      return unwrapMaybe(
        'handoffs.getByReference',
        await db.from('handoff_requests').select('*').eq('reference_code', referenceCode).maybeSingle()
      );
    },

    async listByStatus(status: HandoffStatus, language?: LanguageCode, limit = 50): Promise<HandoffRequest[]> {
      let query = db.from('handoff_requests').select('*').eq('status', status).order('created_at').limit(limit);
      if (language) query = query.eq('language', language);
      return unwrap('handoffs.listByStatus', await query);
    },

    /** Server-side assignment (specialists cannot assign themselves through the Data API). */
    async assign(handoffId: string, specialistId: string): Promise<HandoffRequest> {
      return unwrap(
        'handoffs.assign',
        await db
          .from('handoff_requests')
          .update({ assigned_specialist_id: specialistId, status: 'assigned' })
          .eq('id', handoffId)
          .select('*')
          .single()
      );
    },

    async updateStatus(handoffId: string, status: HandoffStatus, specialistResponse?: string): Promise<HandoffRequest> {
      const patch = specialistResponse === undefined ? { status } : { status, specialist_response: specialistResponse };
      return unwrap(
        'handoffs.updateStatus',
        await db.from('handoff_requests').update(patch).eq('id', handoffId).select('*').single()
      );
    },

    async getEvents(handoffId: string): Promise<Tables<'handoff_events'>[]> {
      return unwrap(
        'handoffs.getEvents',
        await db.from('handoff_events').select('*').eq('handoff_id', handoffId).order('created_at').order('id')
      );
    },

    async getConsultedChunkIds(handoffId: string): Promise<string[]> {
      const rows = unwrap(
        'handoffs.getConsultedChunkIds',
        await db.from('handoff_consulted_sources').select('chunk_id').eq('handoff_id', handoffId)
      );
      return rows.map((r) => r.chunk_id);
    },
  };
}
