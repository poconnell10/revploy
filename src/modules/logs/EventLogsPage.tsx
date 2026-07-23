import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  CustomDropdown,
  type DropdownOption,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'

const EVENT_TYPE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'All Event Types', dot: '#e8ecf2' },
  { value: 'ttv', label: 'TTV Events', dot: '#2563eb' },
  { value: 'task', label: 'Task Events', dot: '#d97706' },
  { value: 'property', label: 'Property Events', dot: '#16a34a' },
  { value: 'integrity_validation', label: 'Integrity Events', dot: '#16a34a' },
  { value: 'journal', label: 'Journal Events', dot: '#9aa3b2' },
  { value: 'user', label: 'User Events', dot: '#0d1f3c' },
  { value: 'data', label: 'Data Ingest Events', dot: '#16a34a' },
]

interface UnifiedEventRow {
  id: string
  kind: 'outbox' | 'ingest'
  event_type: string
  property_label: string | null
  payload: unknown
  created_at: string
  processed_at: string | null
  ingest_status: 'received' | 'processed' | 'failed' | null
}

interface EventPage {
  rows: UnifiedEventRow[]
  total: number
}

const TH_CLASS =
  'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted'

// Event-type pill colors by prefix (text / background).
const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  property: { color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
  task: { color: 'var(--color-purple)', bg: 'var(--color-purple-bg)' },
  ttv: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  integrity_validation: {
    color: 'var(--color-success)',
    bg: 'var(--color-success-bg)',
  },
  journal: { color: 'var(--color-muted)', bg: 'var(--color-gray-50)' },
  user: { color: 'var(--color-navy)', bg: 'var(--color-gray-100)' },
  data: { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
}

function typeStyle(eventType: string): { color: string; bg: string } {
  const prefix = eventType.split('.')[0]
  return (
    TYPE_STYLES[prefix] ?? {
      color: 'var(--color-muted)',
      bg: 'var(--color-gray-50)',
    }
  )
}

function formatDateTime(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return iso
  const date = dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = dt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  return `${date} ${time}`
}

function getPropertyId(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>).property_id
    if (typeof value === 'string') return value
  }
  return null
}

function payloadPreview(payload: unknown): string {
  const json = JSON.stringify(payload)
  return json.length > 60 ? `${json.slice(0, 60)}…` : json
}

function ingestStatusBadge(status: UnifiedEventRow['ingest_status']) {
  if (status === 'processed') {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-[20px] bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">
        ✓ Processed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-[20px] bg-danger-subtle px-2 py-0.5 text-[11px] font-semibold text-danger">
        ✗ Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-[20px] bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-muted">
      Pending
    </span>
  )
}

export function EventLogsPage() {
  const [limit, setLimit] = useState(100)
  const [eventType, setEventType] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const query = useQuery({
    queryKey: ['event-logs', limit, eventType],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<EventPage> => {
      const includeOutbox = eventType !== 'data'
      const includeIngest = !eventType || eventType === 'data'

      const outboxPromise = includeOutbox
        ? (() => {
            let request = supabase
              .from('event_outbox')
              .select('id, event_type, payload, created_at, processed_at', {
                count: 'exact',
              })
              .order('created_at', { ascending: false })
            if (eventType) {
              request = request.like('event_type', `${eventType}%`)
            }
            return request.limit(limit)
          })()
        : Promise.resolve({ data: [], error: null, count: 0 })

      const ingestPromise = includeIngest
        ? supabase
            .from('ingest_events')
            .select(
              'id, property_code, s3_bucket, s3_key, source, status, tasks_updated, error_message, processed_at, created_at, properties(code)',
              { count: 'exact' },
            )
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null, count: 0 })

      const [outboxRes, ingestRes] = await Promise.all([
        outboxPromise,
        ingestPromise,
      ])

      if (outboxRes.error) throw outboxRes.error
      if (ingestRes.error) throw ingestRes.error

      const outboxRows: UnifiedEventRow[] = (outboxRes.data ?? []).map(
        (event) => {
          const propertyId = getPropertyId(event.payload)
          return {
            id: `outbox:${event.id}`,
            kind: 'outbox',
            event_type: event.event_type,
            property_label: propertyId
              ? `${propertyId.slice(0, 8)}…`
              : null,
            payload: event.payload,
            created_at: event.created_at,
            processed_at: event.processed_at,
            ingest_status: null,
          }
        },
      )

      const ingestRows: UnifiedEventRow[] = (ingestRes.data ?? []).map(
        (event) => {
          const props = event.properties as
            | { code: string }
            | { code: string }[]
            | null
          const joinedCode = Array.isArray(props)
            ? props[0]?.code
            : props?.code
          return {
            id: `ingest:${event.id}`,
            kind: 'ingest',
            event_type: 'data.ingested',
            property_label: joinedCode || event.property_code || null,
            payload: {
              s3_bucket: event.s3_bucket,
              s3_key: event.s3_key,
              source: event.source,
              status: event.status,
              tasks_updated: event.tasks_updated,
              error_message: event.error_message,
            },
            created_at: event.created_at,
            processed_at: event.processed_at,
            ingest_status: event.status as UnifiedEventRow['ingest_status'],
          }
        },
      )

      const merged = [...outboxRows, ...ingestRows].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )

      return {
        rows: merged.slice(0, limit),
        total: (outboxRes.count ?? 0) + (ingestRes.count ?? 0),
      }
    },
  })

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-navy">Event Logs</h1>
        <div className="flex items-center gap-2.5">
          <CustomDropdown
            options={EVENT_TYPE_OPTIONS}
            value={eventType}
            onChange={setEventType}
            width="200px"
          />
          <button
            type="button"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
          >
            {query.isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mb-1.5 text-sm font-semibold text-gray-700">
              No events yet
            </div>
            <div className="text-[13px] text-muted">
              Events will appear here as properties are created and updated
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f8fafc]">
                  <th className={TH_CLASS}>Timestamp</th>
                  <th className={TH_CLASS}>Event Type</th>
                  <th className={TH_CLASS}>Property</th>
                  <th className={TH_CLASS}>Payload</th>
                  <th className={TH_CLASS}>Processed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => {
                  const style = typeStyle(event.event_type)
                  const isOpen = expanded.has(event.id)
                  return (
                    <tr
                      key={event.id}
                      onClick={() => toggle(event.id)}
                      className="cursor-pointer border-b border-gray-50 align-top transition-colors hover:bg-[#fafafa]"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] text-gray-700">
                        {formatDateTime(event.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block whitespace-nowrap rounded-[20px] px-2 py-0.5 font-mono text-[11px] font-semibold"
                          style={{ color: style.color, background: style.bg }}
                        >
                          {event.event_type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted">
                        {event.property_label ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isOpen ? (
                          <pre className="max-w-[420px] overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-[12px] leading-relaxed text-gray-700">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        ) : (
                          <span className="font-mono text-[11.5px] text-muted">
                            {payloadPreview(event.payload)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {event.kind === 'ingest' ? (
                          ingestStatusBadge(event.ingest_status)
                        ) : event.processed_at ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-[20px] bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">
                            ✓ Processed
                          </span>
                        ) : (
                          <span className="inline-flex items-center whitespace-nowrap rounded-[20px] bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-muted">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted">
            Showing {rows.length} of {total} events
          </span>
          {rows.length < total && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + 100)}
              disabled={query.isFetching}
              className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
            >
              {query.isFetching ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
