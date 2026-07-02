import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import {
  LifecycleBadge,
  PhaseBadge,
  RiskBadge,
  Sparkline,
  TTVBadge,
  TTVDonut,
  type LifecycleState,
  type Phase,
  type RiskLevel,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

// Placeholder trend until real historical TTV data is wired in.
const MOCK_TREND = [65, 70, 68, 75, 78]

type LifecycleFilter = 'all' | LifecycleState
type RiskFilter = 'all' | RiskLevel
type View = 'table' | 'cards'

interface DashboardProperty {
  id: string
  code: string
  name: string
  city: string | null
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  region: string
  tech_owner: string
  start_date: string | null
  ttv_data: number | null
  ttv_config: number | null
  ttv_prov: number | null
  ttv_overall: number
  risk: RiskLevel
  tasks_complete: number
  tasks_total: number
}

// ---------------------------------------------------------------------------
// Data loading — two queries merged client-side (the JS client can't express
// the GROUP BY + subqueries in one shot).
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

interface PhaseAgg {
  complete: number
  started: number
  total: number
}

function emptyPhase(): PhaseAgg {
  return { complete: 0, started: 0, total: 0 }
}

function buildProperties(
  props: PropertyQueryRow[],
  taskRows: TaskCountRow[],
  contacts: ContactRow[],
): DashboardProperty[] {
  const agg = new Map<
    string,
    { total: number; complete: number; phase: Record<Phase, PhaseAgg> }
  >()

  for (const row of taskRows) {
    const entry = agg.get(row.property_id) ?? {
      total: 0,
      complete: 0,
      phase: {
        data: emptyPhase(),
        configuration: emptyPhase(),
        provisioning: emptyPhase(),
      },
    }
    entry.total += 1
    const done = row.status === 'complete'
    if (done) entry.complete += 1
    const phase = row.definition?.phase
    if (phase) {
      entry.phase[phase].total += 1
      if (done) entry.phase[phase].complete += 1
      if (row.status !== 'not_started') entry.phase[phase].started += 1
    }
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
    const data = a?.phase.data ?? emptyPhase()
    const config = a?.phase.configuration ?? emptyPhase()
    const prov = a?.phase.provisioning ?? emptyPhase()

    const ttv_data =
      data.total > 0 ? Math.round((data.complete / 6) * 100) : null
    const ttv_config =
      config.started > 0 ? Math.round((config.complete / 8) * 100) : null
    const ttv_prov =
      prov.started > 0 ? Math.round((prov.complete / 6) * 100) : null
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
      start_date: p.start_date,
      ttv_data,
      ttv_config,
      ttv_prov,
      ttv_overall,
      risk: deriveRisk(ttv_overall),
      tasks_complete: complete,
      tasks_total: total,
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ttvColor(score: number | null): string {
  if (score === null) return 'var(--color-muted)'
  if (score >= 85) return 'var(--color-success)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  const start = new Date(`${dateStr}T00:00:00`).getTime()
  if (Number.isNaN(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function exportCsv(rows: DashboardProperty[]): void {
  const headers = [
    'Code',
    'Name',
    'City',
    'State',
    'Phase',
    'Region',
    'Tech Owner',
    'Data TTV',
    'Config TTV',
    'Prov TTV',
    'Overall TTV',
    'Risk',
    'Tasks',
  ]
  const lines = rows.map((p) =>
    [
      p.code,
      p.name,
      p.city ?? '',
      p.lifecycle_state,
      p.phase_current ?? '',
      p.region,
      p.tech_owner,
      p.ttv_data ?? '',
      p.ttv_config ?? '',
      p.ttv_prov ?? '',
      p.ttv_overall,
      p.risk,
      `${p.tasks_complete}/${p.tasks_total}`,
    ]
      .map(csvCell)
      .join(','),
  )
  const csv = [headers.map(csvCell).join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'properties.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function StatCard({
  label,
  value,
  sub,
  valueClassName = 'text-navy',
  critical = false,
}: {
  label: string
  value: string
  sub: string
  valueClassName?: string
  critical?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        critical ? 'border-[#fecaca] bg-[#fff5f5]' : 'border-gray-100 bg-white',
      )}
    >
      <div
        className={cn(
          'mb-1.5 text-[11px] font-medium uppercase tracking-wide',
          critical ? 'text-danger' : 'text-muted',
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-[28px] font-bold leading-none',
          valueClassName,
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'mt-1.5 text-[11.5px]',
          critical ? 'text-danger' : 'text-muted',
        )}
      >
        {sub}
      </div>
    </div>
  )
}

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

const SELECT_CLASS =
  'rounded-md border border-gray-100 bg-white px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-gold'

const TH_CLASS =
  'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted'

export function DashboardPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('table')
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>('all')
  const [region, setRegion] = useState<string>('all')
  const [risk, setRisk] = useState<RiskFilter>('all')

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

  const regions = useMemo(
    () =>
      Array.from(
        new Set(properties.map((p) => p.region).filter(Boolean)),
      ).sort(),
    [properties],
  )

  const filtered = useMemo(
    () =>
      properties.filter(
        (p) =>
          (lifecycle === 'all' || p.lifecycle_state === lifecycle) &&
          (region === 'all' || p.region === region) &&
          (risk === 'all' || p.risk === risk),
      ),
    [properties, lifecycle, region, risk],
  )

  const total = properties.length
  const onboarding = properties.filter(
    (p) => p.lifecycle_state === 'onboarding',
  ).length
  const activated = properties.filter(
    (p) => p.lifecycle_state === 'activated',
  ).length
  const critical = properties.filter((p) => p.risk === 'critical').length
  const avgTtv = properties.length
    ? Math.round(
        properties.reduce((sum, p) => sum + p.ttv_overall, 0) /
          properties.length,
      )
    : 0

  const openProperty = (id: string) => navigate(`/properties/${id}`)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex rounded-lg border border-gray-100 bg-gray-50 p-0.5">
          {(['table', 'cards'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                view === v
                  ? 'bg-navy text-white'
                  : 'text-muted hover:text-gray-700',
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => exportCsv(filtered)}
          className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => navigate('/properties/new')}
          className="rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-navy transition-[filter] hover:brightness-95"
        >
          + Add Property
        </button>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
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
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Total Properties"
              value={String(total)}
              sub={`${onboarding} onboarding`}
            />
            <StatCard
              label="Activated"
              value={String(activated)}
              sub="Live properties"
              valueClassName="text-success"
            />
            <StatCard
              label="Avg Overall TTV"
              value={`${avgTtv}%`}
              sub="Across active properties"
            />
            <StatCard
              label="Critical Risk"
              value={String(critical)}
              sub="Require attention"
              valueClassName="text-danger"
              critical
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-medium text-muted">Filter:</span>
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value as LifecycleFilter)}
              className={SELECT_CLASS}
            >
              <option value="all">All Lifecycle States</option>
              <option value="onboarding">Onboarding</option>
              <option value="activated">Activated</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="all">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value as RiskFilter)}
              className={SELECT_CLASS}
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <span className="ml-auto font-mono text-xs text-muted">
              {filtered.length} properties
            </span>
          </div>

          {/* Content */}
          {total === 0 ? (
            <EmptyState
              title="No properties yet"
              subtitle="Create your first property to get started."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No properties match your filters"
              subtitle="Try adjusting your filters"
            />
          ) : view === 'table' ? (
            <div className="relative overflow-hidden rounded-xl border border-gray-100 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#f8fafc]">
                      <th className={cn(TH_CLASS, 'w-[90px]')}>Code</th>
                      <th className={TH_CLASS}>Property</th>
                      <th className={TH_CLASS}>State</th>
                      <th className={TH_CLASS}>Phase</th>
                      <th className={TH_CLASS}>Region</th>
                      <th className={TH_CLASS}>Tech Owner</th>
                      <th className={TH_CLASS}>Data TTV</th>
                      <th className={TH_CLASS}>Config TTV</th>
                      <th className={TH_CLASS}>Prov TTV</th>
                      <th className={TH_CLASS}>Overall TTV</th>
                      <th className={TH_CLASS}>Risk</th>
                      <th className={TH_CLASS}>Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => openProperty(p.id)}
                        className="cursor-pointer border-b border-gray-50 transition-colors hover:bg-[#fdf8ee]"
                      >
                        <td className="px-3 py-2.5">
                          <span className="whitespace-nowrap font-mono text-[11px] text-muted">
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
                          <div className="flex items-center gap-2">
                            <TTVBadge score={p.ttv_data} size="sm" />
                            <Sparkline
                              data={MOCK_TREND}
                              color={ttvColor(p.ttv_data)}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <TTVBadge score={p.ttv_config} size="sm" />
                        </td>
                        <td className="px-3 py-2.5">
                          <TTVBadge score={p.ttv_prov} size="sm" />
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
              {/* Right-edge scroll fade */}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-14 bg-gradient-to-l from-white" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  onClick={() => openProperty(p.id)}
                  className="flex cursor-pointer flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-navy">
                        {p.name}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-muted">
                        {p.code} · {p.city}
                      </div>
                    </div>
                    <RiskBadge risk={p.risk} />
                  </div>

                  <div className="flex items-center justify-center gap-4 py-1">
                    <TTVDonut score={p.ttv_overall} size={48} />
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-11 text-[11px] text-muted">
                          Data
                        </span>
                        <TTVBadge score={p.ttv_data} size="sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-11 text-[11px] text-muted">
                          Config
                        </span>
                        <TTVBadge score={p.ttv_config} size="sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-11 text-[11px] text-muted">
                          Prov
                        </span>
                        <TTVBadge score={p.ttv_prov} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <LifecycleBadge state={p.lifecycle_state} />
                    <PhaseBadge phase={p.phase_current} />
                  </div>

                  <TaskProgress
                    complete={p.tasks_complete}
                    total={p.tasks_total}
                  />

                  <div className="flex items-center justify-between border-t border-gray-50 pt-2.5 text-[11.5px] text-muted">
                    <span>{p.tech_owner}</span>
                    <span className="font-mono">
                      {daysSince(p.start_date)}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-xl bg-gray-100"
          />
        ))}
      </div>
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
    </>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
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
      <div className="mb-1.5 text-sm font-semibold text-gray-700">{title}</div>
      <div className="text-[13px] text-muted">{subtitle}</div>
    </div>
  )
}
