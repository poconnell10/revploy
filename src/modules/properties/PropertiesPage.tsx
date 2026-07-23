import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import {
  LifecycleBadge,
  PhaseBadge,
  RiskBadge,
  TTVBadge,
  type LifecycleState,
  type Phase,
  type RiskLevel,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

interface ListProperty {
  id: string
  code: string
  name: string
  city: string | null
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  region: string
  tech_owner: string
  ttv_overall: number
  risk: RiskLevel
  tasks_complete: number
  tasks_total: number
}

// ---------------------------------------------------------------------------
// Data loading — the same two-plus-one queries the dashboard uses, merged
// client-side. Sharing the query keys keeps the two pages on one cache entry.
// ---------------------------------------------------------------------------

interface PropertyQueryRow {
  id: string
  code: string
  name: string
  city: string | null
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  start_date: string | null
  region: { name: string } | null
}

interface TaskCountRow {
  property_id: string
  status: string
  definition: { phase: Phase } | null
}

interface ContactRow {
  property_id: string
  user_id: string
}

function usePropertiesQuery() {
  return useQuery({
    queryKey: ['dashboard-properties'],
    queryFn: async (): Promise<PropertyQueryRow[]> => {
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, code, name, city, lifecycle_state, phase_current, start_date, region:regions(name)',
        )
        .is('archived_at', null)
        .order('code', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as PropertyQueryRow[]
    },
  })
}

function useTaskCountsQuery() {
  return useQuery({
    queryKey: ['dashboard-task-counts'],
    queryFn: async (): Promise<TaskCountRow[]> => {
      const { data, error } = await supabase
        .from('property_lifecycle_tasks')
        .select(
          'property_id, status, definition:lifecycle_task_definitions(phase)',
        )
      if (error) throw error
      return (data ?? []) as unknown as TaskCountRow[]
    },
  })
}

function useTechOwnersQuery() {
  return useQuery({
    queryKey: ['dashboard-tech-owners'],
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await supabase
        .from('property_contacts')
        .select('property_id, user_id')
        .eq('role_type', 'tech_owner')
        .eq('active', true)
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
  })
}

function deriveRisk(overall: number): RiskLevel {
  if (overall === 0) return 'critical'
  if (overall >= 85) return 'low'
  if (overall >= 50) return 'medium'
  return 'high'
}

function buildProperties(
  props: PropertyQueryRow[],
  taskRows: TaskCountRow[],
  contacts: ContactRow[],
): ListProperty[] {
  const agg = new Map<string, { total: number; complete: number }>()
  for (const row of taskRows) {
    const entry = agg.get(row.property_id) ?? { total: 0, complete: 0 }
    entry.total += 1
    if (row.status === 'complete') entry.complete += 1
    agg.set(row.property_id, entry)
  }

  const techByProperty = new Map<string, string>()
  for (const contact of contacts) {
    if (!techByProperty.has(contact.property_id)) {
      techByProperty.set(contact.property_id, contact.user_id)
    }
  }

  return props.map((p) => {
    const a = agg.get(p.id)
    const total = a?.total ?? 0
    const complete = a?.complete ?? 0
    const ttv_overall = total > 0 ? Math.round((complete / total) * 100) : 0
    const tech = techByProperty.get(p.id)

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      city: p.city,
      lifecycle_state: p.lifecycle_state,
      phase_current: p.phase_current,
      region: p.region?.name ?? '',
      tech_owner: tech ? `${tech.slice(0, 8)}…` : '—',
      ttv_overall,
      risk: deriveRisk(ttv_overall),
      tasks_complete: complete,
      tasks_total: total,
    }
  })
}

const TH_CLASS =
  'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted'

function TaskProgress({
  complete,
  total,
}: {
  complete: number
  total: number
}) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-12 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap font-mono text-[11.5px] font-semibold text-gray-700">
        {complete}/{total}
      </span>
    </div>
  )
}

export function PropertiesPage() {
  const navigate = useNavigate()
  const propertiesQuery = usePropertiesQuery()
  const taskCountsQuery = useTaskCountsQuery()
  const techOwnersQuery = useTechOwnersQuery()

  const isLoading = propertiesQuery.isLoading || taskCountsQuery.isLoading
  const isError = propertiesQuery.isError

  const properties = useMemo(
    () =>
      buildProperties(
        propertiesQuery.data ?? [],
        taskCountsQuery.data ?? [],
        techOwnersQuery.data ?? [],
      ),
    [propertiesQuery.data, taskCountsQuery.data, techOwnersQuery.data],
  )

  const openProperty = (id: string) => navigate(`/properties/${id}`)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">Properties</h1>
        <button
          type="button"
          onClick={() => navigate('/properties/new')}
          className="rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-navy transition-[filter] hover:brightness-95"
        >
          + Add Property
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#fecaca] bg-danger-subtle px-6 py-12 text-center">
          <div className="text-sm font-semibold text-danger">
            Could not load properties
          </div>
          <div className="mt-1 text-[13px] text-danger">
            {propertiesQuery.error instanceof Error
              ? propertiesQuery.error.message
              : 'Please try again.'}
          </div>
        </div>
      ) : properties.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-muted)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
          <div className="mb-1.5 text-sm font-semibold text-gray-700">
            No properties yet
          </div>
          <div className="text-[13px] text-gray-400">
            Click + Add Property to get started
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f8fafc]">
                  <th className={cn(TH_CLASS, 'w-[90px]')}>Code</th>
                  <th className={TH_CLASS}>Property</th>
                  <th className={TH_CLASS}>State</th>
                  <th className={TH_CLASS}>Phase</th>
                  <th className={TH_CLASS}>Region</th>
                  <th className={TH_CLASS}>Tech Owner</th>
                  <th className={TH_CLASS}>Overall TTV</th>
                  <th className={TH_CLASS}>Risk</th>
                  <th className={TH_CLASS}>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openProperty(p.id)}
                    className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-[#fdf8ee]"
                  >
                    <td className="px-3 py-2.5">
                      <span className="whitespace-nowrap font-mono text-[11px] text-gray-400">
                        {p.code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="whitespace-nowrap text-[13px] font-medium text-navy">
                        {p.name}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {p.city}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <LifecycleBadge state={p.lifecycle_state} />
                    </td>
                    <td className="px-3 py-2.5">
                      {p.phase_current ? (
                        <PhaseBadge phase={p.phase_current} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px]">
                      {p.region || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-[12.5px]">
                      {p.tech_owner}
                    </td>
                    <td className="px-3 py-2.5">
                      <TTVBadge
                        score={p.ttv_overall}
                        size="sm"
                        className="font-bold"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskBadge risk={p.risk} />
                    </td>
                    <td className="px-3 py-2.5">
                      <TaskProgress
                        complete={p.tasks_complete}
                        total={p.tasks_total}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
