/**
 * Helpers for detecting and explaining Supabase database errors.
 *
 * The most common one is a missing table, which almost always means the project
 * schema (`supabase/schema.sql`) has not been applied yet. Supabase reports this
 * as "Could not find the table 'public.events' in the schema cache".
 */

export const DATABASE_SETUP_MESSAGE =
  'Database not set up yet. Open your Supabase project, go to the SQL Editor, paste the contents of supabase/schema.sql, and run it once.';

type ErrorLike = { code?: string; message?: string } | null | undefined;

/** Detects "table missing" / stale PostgREST schema cache errors from Supabase. */
export function isMissingTableError(error: ErrorLike): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const message = error.message ?? '';
  return (
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    /schema cache/i.test(message) ||
    /does not exist/i.test(message)
  );
}
