import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

interface EventRow {
  id: string
  event_type: string
  payload: unknown
  created_at: string
  processed_at: string | null
}

interface EventPage {
  rows: EventRow[]
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

export function EventLogsPage() {
  const [limit, setLimit] = useState(100)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const query = useQuery({
    queryKey: ['event-logs', limit],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<EventPage> => {
      const { data, error, count } = await supabase
        .from('event_outbox')
        .select('id, event_type, payload, created_at, processed_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return { rows: (data ?? []) as EventRow[], total: count ?? 0 }
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">Event Logs</h1>
        <button
          type="button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
        >
          {query.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
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
                  const propertyId = getPropertyId(event.payload)
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
                        {propertyId ? `${propertyId.slice(0, 8)}…` : '—'}
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
                        {event.processed_at ? (
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
