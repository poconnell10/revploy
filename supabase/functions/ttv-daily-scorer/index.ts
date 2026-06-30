// Supabase Edge Function: ttv-daily-scorer
//
// Scaffold only. Computes daily time-to-value (TTV) scores. Intended to be
// invoked on a schedule (e.g. pg_cron / Supabase scheduled functions).
// Runs on the Deno runtime — see https://supabase.com/docs/guides/functions
//
// deno-lint-ignore-file no-explicit-any
declare const Deno: any

Deno.serve(async (_req: Request): Promise<Response> => {
  // TODO: load the day's records, compute scores and persist the results.
  return new Response(JSON.stringify({ ok: true, scored: 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
