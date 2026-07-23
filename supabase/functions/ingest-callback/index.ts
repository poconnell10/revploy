// Supabase Edge Function: ingest-callback
//
// Called by the S3→Lambda pipeline (and manual test UI) when data lands in a
// property's ingest bucket. Marks data_ingestion complete for every active
// product on the property.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const Deno: any

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type IngestSource = 's3_trigger' | 'manual_test' | 'curl'

interface IngestBody {
  property_code?: string
  s3_bucket?: string
  s3_key?: string | null
  source?: IngestSource
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || null
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method Not Allowed' })
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

  let ingestEventId: string | null = null
  const admin = createClient(supabaseUrl, serviceRoleKey)

  try {
    const body = (await req.json()) as IngestBody
    const propertyCode = body.property_code?.trim()
    const s3Bucket = body.s3_bucket?.trim()
    const s3Key = body.s3_key?.trim() || null
    const source = body.source

    if (!propertyCode || !s3Bucket || !source) {
      return json(400, {
        success: false,
        error: 'property_code, s3_bucket, and source are required',
      })
    }

    if (!['s3_trigger', 'manual_test', 'curl'].includes(source)) {
      return json(400, { success: false, error: 'Invalid source' })
    }

    // Auth: manual_test accepts the anon key; everything else needs service role.
    const token = bearerToken(req)
    if (!token) {
      return json(401, { success: false, error: 'Missing Authorization' })
    }
    if (source === 'manual_test') {
      if (token !== anonKey && token !== serviceRoleKey) {
        return json(401, {
          success: false,
          error: 'manual_test requires anon or service role key',
        })
      }
    } else if (token !== serviceRoleKey) {
      return json(401, {
        success: false,
        error: 'service role key required',
      })
    }

    const { data: property, error: propertyError } = await admin
      .from('properties')
      .select('id, code')
      .eq('code', propertyCode)
      .maybeSingle()

    if (propertyError) throw propertyError
    if (!property) {
      return json(404, {
        success: false,
        error: `Property not found: ${propertyCode}`,
      })
    }

    const { data: ingestEvent, error: insertError } = await admin
      .from('ingest_events')
      .insert({
        property_id: property.id,
        property_code: property.code,
        s3_bucket: s3Bucket,
        s3_key: s3Key,
        source,
        status: 'received',
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    ingestEventId = ingestEvent.id

    const { data: products, error: productsError } = await admin
      .from('property_products')
      .select('id')
      .eq('property_id', property.id)
      .neq('lifecycle_state', 'archived')

    if (productsError) throw productsError

    const productIds = (products ?? []).map((p: { id: string }) => p.id)
    let tasksUpdated = 0

    if (productIds.length > 0) {
      const { data: definition, error: defError } = await admin
        .from('lifecycle_task_definitions')
        .select('id')
        .eq('task_key', 'data_ingestion')
        .single()

      if (defError) throw defError

      const now = new Date().toISOString()
      const { data: updated, error: updateError } = await admin
        .from('property_lifecycle_tasks')
        .update({
          status: 'complete',
          completed_at: now,
          updated_at: now,
        })
        .eq('property_id', property.id)
        .eq('task_definition_id', definition.id)
        .in('property_product_id', productIds)
        .select('id')

      if (updateError) throw updateError
      tasksUpdated = updated?.length ?? 0
    }

    const journalBody =
      `Data ingested automatically from S3 (${s3Bucket}). ` +
      `${tasksUpdated} product(s) updated.`

    const { error: journalError } = await admin.from('journal_entries').insert({
      property_id: property.id,
      author_id: property.id,
      entry_type: 'system_event',
      system_template: 'TASK_COMPLETED',
      body: journalBody,
      customer_visible: false,
    })
    if (journalError) throw journalError

    const { error: eventError } = await admin.rpc('dispatch_event', {
      event_type: 'task.completed',
      payload: {
        task_key: 'data_ingestion',
        property_id: property.id,
        source,
      },
    })
    if (eventError) throw eventError

    const processedAt = new Date().toISOString()
    const { error: finalizeError } = await admin
      .from('ingest_events')
      .update({
        status: 'processed',
        tasks_updated: tasksUpdated,
        processed_at: processedAt,
      })
      .eq('id', ingestEventId)

    if (finalizeError) throw finalizeError

    return json(200, {
      success: true,
      property_id: property.id,
      tasks_updated: tasksUpdated,
      ingest_event_id: ingestEventId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('ingest-callback failed:', message)

    if (ingestEventId) {
      await admin
        .from('ingest_events')
        .update({ status: 'failed', error_message: message })
        .eq('id', ingestEventId)
    }

    return json(500, { success: false, error: message })
  }
})
