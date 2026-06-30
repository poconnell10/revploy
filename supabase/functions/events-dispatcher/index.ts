// Supabase Edge Function: events-dispatcher
//
// Scaffold only. Dispatches domain events to their downstream handlers.
// Runs on the Deno runtime — see https://supabase.com/docs/guides/functions
//
// deno-lint-ignore-file no-explicit-any
declare const Deno: any

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // TODO: parse the event payload and route it to the appropriate handler.
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
