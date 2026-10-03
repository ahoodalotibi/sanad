import type { SanadDbClient } from '../client.ts';
import { unwrap } from '../errors.ts';
import type { EvalCasePrompt, EvalResult, EvalRun, EvalTestCase, Json, TablesInsert } from '../types.ts';

export interface EvalCaseWithPrompts extends EvalTestCase {
  eval_case_prompts: Pick<EvalCasePrompt, 'id' | 'language' | 'prompt'>[];
}

export function createEvaluationsRepository(db: SanadDbClient) {
  return {
    async listActiveCases(): Promise<EvalCaseWithPrompts[]> {
      return unwrap(
        'evaluations.listActiveCases',
        await db
          .from('eval_test_cases')
          .select('*, eval_case_prompts(id, language, prompt)')
          .eq('is_active', true)
          .order('code')
      );
    },

    /** Idempotent by case code; prompts are upserted per (case, language, prompt). */
    async upsertCase(
      testCase: TablesInsert<'eval_test_cases'>,
      prompts: { language: string; prompt: string }[]
    ): Promise<EvalCaseWithPrompts> {
      const saved = unwrap(
        'evaluations.upsertCase',
        await db.from('eval_test_cases').upsert(testCase, { onConflict: 'code' }).select('*').single()
      );
      const savedPrompts =
        prompts.length === 0
          ? []
          : unwrap(
              'evaluations.upsertPrompts',
              await db
                .from('eval_case_prompts')
                .upsert(
                  prompts.map((p) => ({ ...p, case_id: saved.id })),
                  { onConflict: 'case_id,language,prompt' }
                )
                .select('id, language, prompt')
            );
      return { ...saved, eval_case_prompts: savedPrompts };
    },

    async startRun(run: Omit<TablesInsert<'eval_runs'>, 'id' | 'started_at' | 'finished_at' | 'summary'> = {}): Promise<EvalRun> {
      return unwrap('evaluations.startRun', await db.from('eval_runs').insert(run).select('*').single());
    },

    async recordResult(result: Omit<TablesInsert<'eval_results'>, 'id' | 'created_at'>): Promise<EvalResult> {
      return unwrap('evaluations.recordResult', await db.from('eval_results').insert(result).select('*').single());
    },

    async finishRun(runId: string, summary: Json): Promise<EvalRun> {
      return unwrap(
        'evaluations.finishRun',
        await db
          .from('eval_runs')
          .update({ finished_at: new Date().toISOString(), summary })
          .eq('id', runId)
          .select('*')
          .single()
      );
    },

    async getResults(runId: string): Promise<EvalResult[]> {
      return unwrap('evaluations.getResults', await db.from('eval_results').select('*').eq('run_id', runId).order('id'));
    },
  };
}
