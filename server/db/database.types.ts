export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      chunk_references: {
        Row: {
          ayah_id: number | null;
          chunk_id: string;
          created_at: string;
          hadith_id: string | null;
          id: number;
          term_id: string | null;
        };
        Insert: {
          ayah_id?: number | null;
          chunk_id: string;
          created_at?: string;
          hadith_id?: string | null;
          id?: never;
          term_id?: string | null;
        };
        Update: {
          ayah_id?: number | null;
          chunk_id?: string;
          created_at?: string;
          hadith_id?: string | null;
          id?: never;
          term_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chunk_references_ayah_id_fkey";
            columns: ["ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chunk_references_chunk_id_fkey";
            columns: ["chunk_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chunk_references_hadith_id_fkey";
            columns: ["hadith_id"];
            isOneToOne: false;
            referencedRelation: "hadiths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chunk_references_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          anonymous_session_hash: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          language: string;
          last_message_at: string | null;
          title: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          anonymous_session_hash?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          language: string;
          last_message_at?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          anonymous_session_hash?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          language?: string;
          last_message_at?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      documents: {
        Row: {
          canonical_url: string | null;
          content_sha256: string | null;
          created_at: string;
          external_ref: string | null;
          id: string;
          language: string;
          license_note: string | null;
          metadata: NonNullable<Json>;
          publication_status: Database["public"]["Enums"]["publication_status"];
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          canonical_url?: string | null;
          content_sha256?: string | null;
          created_at?: string;
          external_ref?: string | null;
          id?: string;
          language: string;
          license_note?: string | null;
          metadata?: NonNullable<Json>;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          canonical_url?: string | null;
          content_sha256?: string | null;
          created_at?: string;
          external_ref?: string | null;
          id?: string;
          language?: string;
          license_note?: string | null;
          metadata?: NonNullable<Json>;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "documents_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_case_prompts: {
        Row: {
          case_id: string;
          id: string;
          language: string;
          prompt: string;
        };
        Insert: {
          case_id: string;
          id?: string;
          language: string;
          prompt: string;
        };
        Update: {
          case_id?: string;
          id?: string;
          language?: string;
          prompt?: string;
        };
        Relationships: [
          {
            foreignKeyName: "eval_case_prompts_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "eval_test_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "eval_case_prompts_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      eval_results: {
        Row: {
          actual_handoff: boolean | null;
          actual_level: Database["public"]["Enums"]["content_level"] | null;
          actual_refusal: boolean | null;
          case_id: string;
          created_at: string;
          failures: string[];
          id: number;
          language: string;
          latency_ms: number | null;
          passed: boolean;
          prompt_id: string;
          response: Json | null;
          run_id: string;
        };
        Insert: {
          actual_handoff?: boolean | null;
          actual_level?: Database["public"]["Enums"]["content_level"] | null;
          actual_refusal?: boolean | null;
          case_id: string;
          created_at?: string;
          failures?: string[];
          id?: never;
          language: string;
          latency_ms?: number | null;
          passed: boolean;
          prompt_id: string;
          response?: Json | null;
          run_id: string;
        };
        Update: {
          actual_handoff?: boolean | null;
          actual_level?: Database["public"]["Enums"]["content_level"] | null;
          actual_refusal?: boolean | null;
          case_id?: string;
          created_at?: string;
          failures?: string[];
          id?: never;
          language?: string;
          latency_ms?: number | null;
          passed?: boolean;
          prompt_id?: string;
          response?: Json | null;
          run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "eval_results_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "eval_test_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "eval_results_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "eval_results_prompt_fk";
            columns: ["prompt_id", "case_id", "language"];
            isOneToOne: false;
            referencedRelation: "eval_case_prompts";
            referencedColumns: ["id", "case_id", "language"];
          },
          {
            foreignKeyName: "eval_results_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "eval_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_runs: {
        Row: {
          config: NonNullable<Json>;
          embedding_model: string | null;
          finished_at: string | null;
          git_sha: string | null;
          id: string;
          model: string | null;
          notes: string | null;
          prompt_version: string | null;
          started_at: string;
          summary: Json | null;
          triggered_by: string | null;
        };
        Insert: {
          config?: NonNullable<Json>;
          embedding_model?: string | null;
          finished_at?: string | null;
          git_sha?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          prompt_version?: string | null;
          started_at?: string;
          summary?: Json | null;
          triggered_by?: string | null;
        };
        Update: {
          config?: NonNullable<Json>;
          embedding_model?: string | null;
          finished_at?: string | null;
          git_sha?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          prompt_version?: string | null;
          started_at?: string;
          summary?: Json | null;
          triggered_by?: string | null;
        };
        Relationships: [];
      };
      eval_test_cases: {
        Row: {
          assertions: NonNullable<Json>;
          code: string;
          created_at: string;
          expect_handoff: boolean | null;
          expect_refusal: boolean | null;
          expected_behavior_ar: string;
          expected_level: Database["public"]["Enums"]["content_level"] | null;
          expected_source_domains: Database["public"]["Enums"]["source_domain"][];
          id: string;
          is_active: boolean;
          origin: Database["public"]["Enums"]["eval_origin"];
          scenario_ar: string;
          title_ar: string;
          updated_at: string;
        };
        Insert: {
          assertions?: NonNullable<Json>;
          code: string;
          created_at?: string;
          expect_handoff?: boolean | null;
          expect_refusal?: boolean | null;
          expected_behavior_ar: string;
          expected_level?: Database["public"]["Enums"]["content_level"] | null;
          expected_source_domains?: Database["public"]["Enums"]["source_domain"][];
          id?: string;
          is_active?: boolean;
          origin: Database["public"]["Enums"]["eval_origin"];
          scenario_ar: string;
          title_ar: string;
          updated_at?: string;
        };
        Update: {
          assertions?: NonNullable<Json>;
          code?: string;
          created_at?: string;
          expect_handoff?: boolean | null;
          expect_refusal?: boolean | null;
          expected_behavior_ar?: string;
          expected_level?: Database["public"]["Enums"]["content_level"] | null;
          expected_source_domains?: Database["public"]["Enums"]["source_domain"][];
          id?: string;
          is_active?: boolean;
          origin?: Database["public"]["Enums"]["eval_origin"];
          scenario_ar?: string;
          title_ar?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      hadith_collections: {
        Row: {
          created_at: string;
          id: string;
          is_canonical_sahih: boolean;
          name_ar: string;
          name_en: string | null;
          slug: string;
          sort_order: number;
          source_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_canonical_sahih?: boolean;
          name_ar: string;
          name_en?: string | null;
          slug: string;
          sort_order?: number;
          source_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_canonical_sahih?: boolean;
          name_ar?: string;
          name_en?: string | null;
          slug?: string;
          sort_order?: number;
          source_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hadith_collections_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      hadith_translations: {
        Row: {
          created_at: string;
          edition_id: string;
          edition_kind: string;
          hadith_id: string;
          id: number;
          text: string;
        };
        Insert: {
          created_at?: string;
          edition_id: string;
          edition_kind?: string;
          hadith_id: string;
          id?: never;
          text: string;
        };
        Update: {
          created_at?: string;
          edition_id?: string;
          edition_kind?: string;
          hadith_id?: string;
          id?: never;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hadith_translations_edition_fk";
            columns: ["edition_id", "edition_kind"];
            isOneToOne: false;
            referencedRelation: "translation_editions";
            referencedColumns: ["id", "kind"];
          },
          {
            foreignKeyName: "hadith_translations_hadith_id_fkey";
            columns: ["hadith_id"];
            isOneToOne: false;
            referencedRelation: "hadiths";
            referencedColumns: ["id"];
          },
        ];
      };
      hadiths: {
        Row: {
          book_name_ar: string | null;
          chapter_name_ar: string | null;
          collection_id: string;
          created_at: string;
          external_ref: string | null;
          grade: Database["public"]["Enums"]["hadith_grade"];
          grade_text_ar: string | null;
          graded_by: string | null;
          hadith_number: string;
          id: string;
          isnad_ar: string | null;
          narrator_ar: string | null;
          sort_key: number | null;
          source_document_id: string;
          takhrij_ar: string | null;
          text_ar: string;
          text_normalized: string | null;
          updated_at: string;
        };
        Insert: {
          book_name_ar?: string | null;
          chapter_name_ar?: string | null;
          collection_id: string;
          created_at?: string;
          external_ref?: string | null;
          grade: Database["public"]["Enums"]["hadith_grade"];
          grade_text_ar?: string | null;
          graded_by?: string | null;
          hadith_number: string;
          id?: string;
          isnad_ar?: string | null;
          narrator_ar?: string | null;
          sort_key?: number | null;
          source_document_id: string;
          takhrij_ar?: string | null;
          text_ar: string;
          text_normalized?: never;
          updated_at?: string;
        };
        Update: {
          book_name_ar?: string | null;
          chapter_name_ar?: string | null;
          collection_id?: string;
          created_at?: string;
          external_ref?: string | null;
          grade?: Database["public"]["Enums"]["hadith_grade"];
          grade_text_ar?: string | null;
          graded_by?: string | null;
          hadith_number?: string;
          id?: string;
          isnad_ar?: string | null;
          narrator_ar?: string | null;
          sort_key?: number | null;
          source_document_id?: string;
          takhrij_ar?: string | null;
          text_ar?: string;
          text_normalized?: never;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hadiths_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "hadith_collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hadiths_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      handoff_consulted_sources: {
        Row: {
          chunk_id: string;
          handoff_id: string;
        };
        Insert: {
          chunk_id: string;
          handoff_id: string;
        };
        Update: {
          chunk_id?: string;
          handoff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "handoff_consulted_sources_chunk_id_fkey";
            columns: ["chunk_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handoff_consulted_sources_handoff_id_fkey";
            columns: ["handoff_id"];
            isOneToOne: false;
            referencedRelation: "handoff_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      handoff_events: {
        Row: {
          actor_user_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["handoff_status"] | null;
          handoff_id: string;
          id: number;
          to_status: Database["public"]["Enums"]["handoff_status"];
        };
        Insert: {
          actor_user_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["handoff_status"] | null;
          handoff_id: string;
          id?: never;
          to_status: Database["public"]["Enums"]["handoff_status"];
        };
        Update: {
          actor_user_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["handoff_status"] | null;
          handoff_id?: string;
          id?: never;
          to_status?: Database["public"]["Enums"]["handoff_status"];
        };
        Relationships: [
          {
            foreignKeyName: "handoff_events_handoff_id_fkey";
            columns: ["handoff_id"];
            isOneToOne: false;
            referencedRelation: "handoff_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      handoff_requests: {
        Row: {
          ai_summary: string | null;
          assigned_at: string | null;
          assigned_specialist_id: string | null;
          contact_channel: string | null;
          contact_consent: boolean;
          contact_value: string | null;
          conversation_id: string | null;
          created_at: string;
          id: string;
          language: string;
          message_id: string | null;
          question: string;
          reason: Database["public"]["Enums"]["handoff_reason"];
          reference_code: string;
          requester_user_id: string | null;
          resolved_at: string | null;
          specialist_response: string | null;
          status: Database["public"]["Enums"]["handoff_status"];
          updated_at: string;
        };
        Insert: {
          ai_summary?: string | null;
          assigned_at?: string | null;
          assigned_specialist_id?: string | null;
          contact_channel?: string | null;
          contact_consent?: boolean;
          contact_value?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          language: string;
          message_id?: string | null;
          question: string;
          reason: Database["public"]["Enums"]["handoff_reason"];
          reference_code?: string;
          requester_user_id?: string | null;
          resolved_at?: string | null;
          specialist_response?: string | null;
          status?: Database["public"]["Enums"]["handoff_status"];
          updated_at?: string;
        };
        Update: {
          ai_summary?: string | null;
          assigned_at?: string | null;
          assigned_specialist_id?: string | null;
          contact_channel?: string | null;
          contact_consent?: boolean;
          contact_value?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          language?: string;
          message_id?: string | null;
          question?: string;
          reason?: Database["public"]["Enums"]["handoff_reason"];
          reference_code?: string;
          requester_user_id?: string | null;
          resolved_at?: string | null;
          specialist_response?: string | null;
          status?: Database["public"]["Enums"]["handoff_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "handoff_requests_assigned_specialist_id_fkey";
            columns: ["assigned_specialist_id"];
            isOneToOne: false;
            referencedRelation: "specialists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handoff_requests_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "handoff_requests_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "handoff_requests_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          content_level_hint: Database["public"]["Enums"]["content_level"] | null;
          content_normalized: string | null;
          content_type: Database["public"]["Enums"]["chunk_content_type"];
          created_at: string;
          document_id: string;
          embedded_at: string | null;
          embedding: string | null;
          embedding_model: string | null;
          fts: unknown;
          heading: string | null;
          id: string;
          language: string;
          metadata: NonNullable<Json>;
          token_count: number | null;
          updated_at: string;
        };
        Insert: {
          chunk_index: number;
          content: string;
          content_level_hint?: Database["public"]["Enums"]["content_level"] | null;
          content_normalized?: never;
          content_type: Database["public"]["Enums"]["chunk_content_type"];
          created_at?: string;
          document_id: string;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_model?: string | null;
          fts?: never;
          heading?: string | null;
          id?: string;
          language: string;
          metadata?: NonNullable<Json>;
          token_count?: number | null;
          updated_at?: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          content_level_hint?: Database["public"]["Enums"]["content_level"] | null;
          content_normalized?: never;
          content_type?: Database["public"]["Enums"]["chunk_content_type"];
          created_at?: string;
          document_id?: string;
          embedded_at?: string | null;
          embedding?: string | null;
          embedding_model?: string | null;
          fts?: never;
          heading?: string | null;
          id?: string;
          language?: string;
          metadata?: NonNullable<Json>;
          token_count?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_chunks_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      languages: {
        Row: {
          code: string;
          created_at: string;
          direction: string;
          is_ui_enabled: boolean;
          name_en: string;
          native_name: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          direction: string;
          is_ui_enabled?: boolean;
          name_en: string;
          native_name: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          direction?: string;
          is_ui_enabled?: boolean;
          name_en?: string;
          native_name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      message_sources: {
        Row: {
          ayah_id: number | null;
          chunk_id: string | null;
          created_at: string;
          hadith_id: string | null;
          id: number;
          kind: Database["public"]["Enums"]["citation_kind"];
          message_id: string;
          rank: number | null;
          score: number | null;
        };
        Insert: {
          ayah_id?: number | null;
          chunk_id?: string | null;
          created_at?: string;
          hadith_id?: string | null;
          id?: never;
          kind: Database["public"]["Enums"]["citation_kind"];
          message_id: string;
          rank?: number | null;
          score?: number | null;
        };
        Update: {
          ayah_id?: number | null;
          chunk_id?: string | null;
          created_at?: string;
          hadith_id?: string | null;
          id?: never;
          kind?: Database["public"]["Enums"]["citation_kind"];
          message_id?: string;
          rank?: number | null;
          score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_sources_ayah_id_fkey";
            columns: ["ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_sources_chunk_id_fkey";
            columns: ["chunk_id"];
            isOneToOne: false;
            referencedRelation: "knowledge_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_sources_hadith_id_fkey";
            columns: ["hadith_id"];
            isOneToOne: false;
            referencedRelation: "hadiths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_sources_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          confidence: number | null;
          content: string;
          content_level: Database["public"]["Enums"]["content_level"] | null;
          conversation_id: string;
          created_at: string;
          handoff_reason: Database["public"]["Enums"]["handoff_reason"] | null;
          id: string;
          input_mode: Database["public"]["Enums"]["input_mode"];
          is_out_of_scope: boolean;
          language: string;
          latency_ms: number | null;
          model: string | null;
          needs_handoff: boolean;
          prompt_version: string | null;
          response: Json | null;
          role: Database["public"]["Enums"]["message_role"];
        };
        Insert: {
          confidence?: number | null;
          content: string;
          content_level?: Database["public"]["Enums"]["content_level"] | null;
          conversation_id: string;
          created_at?: string;
          handoff_reason?: Database["public"]["Enums"]["handoff_reason"] | null;
          id?: string;
          input_mode?: Database["public"]["Enums"]["input_mode"];
          is_out_of_scope?: boolean;
          language: string;
          latency_ms?: number | null;
          model?: string | null;
          needs_handoff?: boolean;
          prompt_version?: string | null;
          response?: Json | null;
          role: Database["public"]["Enums"]["message_role"];
        };
        Update: {
          confidence?: number | null;
          content?: string;
          content_level?: Database["public"]["Enums"]["content_level"] | null;
          conversation_id?: string;
          created_at?: string;
          handoff_reason?: Database["public"]["Enums"]["handoff_reason"] | null;
          id?: string;
          input_mode?: Database["public"]["Enums"]["input_mode"];
          is_out_of_scope?: boolean;
          language?: string;
          latency_ms?: number | null;
          model?: string | null;
          needs_handoff?: boolean;
          prompt_version?: string | null;
          response?: Json | null;
          role?: Database["public"]["Enums"]["message_role"];
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      quran_ayahs: {
        Row: {
          ayah_number: number;
          created_at: string;
          global_number: number;
          id: number;
          juz: number | null;
          page: number | null;
          source_document_id: string;
          surah_number: number;
          text_normalized: string | null;
          text_simple: string | null;
          text_uthmani: string;
        };
        Insert: {
          ayah_number: number;
          created_at?: string;
          global_number: number;
          id?: never;
          juz?: number | null;
          page?: number | null;
          source_document_id: string;
          surah_number: number;
          text_normalized?: never;
          text_simple?: string | null;
          text_uthmani: string;
        };
        Update: {
          ayah_number?: number;
          created_at?: string;
          global_number?: number;
          id?: never;
          juz?: number | null;
          page?: number | null;
          source_document_id?: string;
          surah_number?: number;
          text_normalized?: never;
          text_simple?: string | null;
          text_uthmani?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quran_ayahs_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quran_ayahs_surah_number_fkey";
            columns: ["surah_number"];
            isOneToOne: false;
            referencedRelation: "quran_surahs";
            referencedColumns: ["number"];
          },
        ];
      };
      quran_surahs: {
        Row: {
          ayah_count: number;
          name_ar: string;
          name_en: string | null;
          name_transliteration: string | null;
          number: number;
          revelation_place: string | null;
        };
        Insert: {
          ayah_count: number;
          name_ar: string;
          name_en?: string | null;
          name_transliteration?: string | null;
          number: number;
          revelation_place?: string | null;
        };
        Update: {
          ayah_count?: number;
          name_ar?: string;
          name_en?: string | null;
          name_transliteration?: string | null;
          number?: number;
          revelation_place?: string | null;
        };
        Relationships: [];
      };
      quran_translations: {
        Row: {
          ayah_id: number;
          created_at: string;
          edition_id: string;
          edition_kind: string;
          footnotes: string | null;
          id: number;
          text: string;
        };
        Insert: {
          ayah_id: number;
          created_at?: string;
          edition_id: string;
          edition_kind?: string;
          footnotes?: string | null;
          id?: never;
          text: string;
        };
        Update: {
          ayah_id?: number;
          created_at?: string;
          edition_id?: string;
          edition_kind?: string;
          footnotes?: string | null;
          id?: never;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quran_translations_ayah_id_fkey";
            columns: ["ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quran_translations_edition_fk";
            columns: ["edition_id", "edition_kind"];
            isOneToOne: false;
            referencedRelation: "translation_editions";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      sources: {
        Row: {
          base_url: string | null;
          created_at: string;
          domain: Database["public"]["Enums"]["source_domain"];
          id: string;
          is_active: boolean;
          is_primary_reference: boolean;
          name_ar: string;
          name_en: string | null;
          reference_section: string | null;
          slug: string;
          updated_at: string;
          usage_rule_ar: string | null;
        };
        Insert: {
          base_url?: string | null;
          created_at?: string;
          domain: Database["public"]["Enums"]["source_domain"];
          id?: string;
          is_active?: boolean;
          is_primary_reference?: boolean;
          name_ar: string;
          name_en?: string | null;
          reference_section?: string | null;
          slug: string;
          updated_at?: string;
          usage_rule_ar?: string | null;
        };
        Update: {
          base_url?: string | null;
          created_at?: string;
          domain?: Database["public"]["Enums"]["source_domain"];
          id?: string;
          is_active?: boolean;
          is_primary_reference?: boolean;
          name_ar?: string;
          name_en?: string | null;
          reference_section?: string | null;
          slug?: string;
          updated_at?: string;
          usage_rule_ar?: string | null;
        };
        Relationships: [];
      };
      specialist_languages: {
        Row: {
          language: string;
          specialist_id: string;
        };
        Insert: {
          language: string;
          specialist_id: string;
        };
        Update: {
          language?: string;
          specialist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialist_languages_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "specialist_languages_specialist_id_fkey";
            columns: ["specialist_id"];
            isOneToOne: false;
            referencedRelation: "specialists";
            referencedColumns: ["id"];
          },
        ];
      };
      specialists: {
        Row: {
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      term_aliases: {
        Row: {
          alias: string;
          alias_normalized: string | null;
          created_at: string;
          id: string;
          language: string;
          term_id: string;
        };
        Insert: {
          alias: string;
          alias_normalized?: never;
          created_at?: string;
          id?: string;
          language: string;
          term_id: string;
        };
        Update: {
          alias?: string;
          alias_normalized?: never;
          created_at?: string;
          id?: string;
          language?: string;
          term_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "term_aliases_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "term_aliases_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      term_translations: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"];
          created_at: string;
          equivalent: string;
          id: string;
          is_preferred: boolean;
          language: string;
          source_id: string;
          term_id: string;
          updated_at: string;
          usage_note: string | null;
        };
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          created_at?: string;
          equivalent: string;
          id?: string;
          is_preferred?: boolean;
          language: string;
          source_id: string;
          term_id: string;
          updated_at?: string;
          usage_note?: string | null;
        };
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          created_at?: string;
          equivalent?: string;
          id?: string;
          is_preferred?: boolean;
          language?: string;
          source_id?: string;
          term_id?: string;
          updated_at?: string;
          usage_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "term_translations_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "term_translations_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "term_translations_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      terms: {
        Row: {
          created_at: string;
          definition_ar: string | null;
          id: string;
          publication_status: Database["public"]["Enums"]["publication_status"];
          slug: string;
          source_id: string;
          term_ar: string;
          term_normalized: string | null;
          updated_at: string;
          usage_guideline_ar: string;
        };
        Insert: {
          created_at?: string;
          definition_ar?: string | null;
          id?: string;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          slug: string;
          source_id: string;
          term_ar: string;
          term_normalized?: never;
          updated_at?: string;
          usage_guideline_ar: string;
        };
        Update: {
          created_at?: string;
          definition_ar?: string | null;
          id?: string;
          publication_status?: Database["public"]["Enums"]["publication_status"];
          slug?: string;
          source_id?: string;
          term_ar?: string;
          term_normalized?: never;
          updated_at?: string;
          usage_guideline_ar?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terms_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      translation_editions: {
        Row: {
          approval_status: Database["public"]["Enums"]["approval_status"];
          created_at: string;
          id: string;
          is_default: boolean;
          kind: string;
          language: string;
          name: string;
          notes: string | null;
          publisher: string | null;
          slug: string;
          source_id: string;
          translator: string | null;
          updated_at: string;
        };
        Insert: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind: string;
          language: string;
          name: string;
          notes?: string | null;
          publisher?: string | null;
          slug: string;
          source_id: string;
          translator?: string | null;
          updated_at?: string;
        };
        Update: {
          approval_status?: Database["public"]["Enums"]["approval_status"];
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind?: string;
          language?: string;
          name?: string;
          notes?: string | null;
          publisher?: string | null;
          slug?: string;
          source_id?: string;
          translator?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "translation_editions_language_fkey";
            columns: ["language"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "translation_editions_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_chunks: {
        Args: {
          embedding_model: string;
          filter_domains?: Database["public"]["Enums"]["source_domain"][];
          include_test_data?: boolean;
          match_count?: number;
          query_embedding: string;
          query_text: string;
        };
        Returns: {
          chunk_id: string;
          content: string;
          content_level_hint: Database["public"]["Enums"]["content_level"];
          content_type: Database["public"]["Enums"]["chunk_content_type"];
          document_id: string;
          document_title: string;
          document_url: string;
          fused_score: number;
          heading: string;
          language: string;
          metadata: Json;
          source_domain: Database["public"]["Enums"]["source_domain"];
          source_id: string;
          source_name_ar: string;
          source_name_en: string;
          source_slug: string;
          source_url: string;
          text_rank: number;
          vector_similarity: number;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "reviewer";
      approval_status: "approved" | "approximate" | "pending_review" | "rejected";
      chunk_content_type:
        | "quran_text"
        | "quran_translation"
        | "tafseer"
        | "hadith_text"
        | "hadith_explanation"
        | "aqeedah"
        | "fiqh"
        | "seerah_history"
        | "qa"
        | "terminology"
        | "dawah";
      citation_kind: "retrieved" | "cited";
      content_level: "A" | "B" | "C" | "D";
      eval_origin: "reference_document" | "extended";
      hadith_grade: "sahih" | "hasan" | "daif" | "mawdu" | "no_basis" | "unknown";
      handoff_reason:
        | "personal_fatwa"
        | "sensitive_dispute"
        | "low_confidence"
        | "unverified_hadith"
        | "out_of_scope"
        | "user_request";
      handoff_status: "pending" | "assigned" | "in_review" | "answered" | "closed" | "cancelled";
      input_mode: "text" | "voice";
      message_role: "user" | "assistant" | "system";
      publication_status: "draft" | "in_review" | "published" | "archived";
      source_domain:
        | "dawah_content"
        | "quran"
        | "tafseer"
        | "hadith"
        | "aqeedah"
        | "fiqh"
        | "seerah_history"
        | "shubuhat_faq"
        | "terminology";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "reviewer"],
      approval_status: ["approved", "approximate", "pending_review", "rejected"],
      chunk_content_type: [
        "quran_text",
        "quran_translation",
        "tafseer",
        "hadith_text",
        "hadith_explanation",
        "aqeedah",
        "fiqh",
        "seerah_history",
        "qa",
        "terminology",
        "dawah",
      ],
      citation_kind: ["retrieved", "cited"],
      content_level: ["A", "B", "C", "D"],
      eval_origin: ["reference_document", "extended"],
      hadith_grade: ["sahih", "hasan", "daif", "mawdu", "no_basis", "unknown"],
      handoff_reason: [
        "personal_fatwa",
        "sensitive_dispute",
        "low_confidence",
        "unverified_hadith",
        "out_of_scope",
        "user_request",
      ],
      handoff_status: ["pending", "assigned", "in_review", "answered", "closed", "cancelled"],
      input_mode: ["text", "voice"],
      message_role: ["user", "assistant", "system"],
      publication_status: ["draft", "in_review", "published", "archived"],
      source_domain: [
        "dawah_content",
        "quran",
        "tafseer",
        "hadith",
        "aqeedah",
        "fiqh",
        "seerah_history",
        "shubuhat_faq",
        "terminology",
      ],
    },
  },
} as const;
