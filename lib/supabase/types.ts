/**
 * Database types.
 *
 * Regenerate with:
 *   supabase gen types typescript --linked > lib/supabase/types.ts
 *
 * Until the schema is pushed, we expose a permissive placeholder so
 * server/client helpers compile.
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};
