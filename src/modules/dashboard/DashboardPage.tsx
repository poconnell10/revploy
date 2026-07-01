import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  LifecycleBadge,
  PhaseBadge,
  RiskBadge,
  Sparkline,
  TTVBadge,
  TTVDonut,
} from '@/shared/components/primitives'
import { cn } from '@/shared/lib/utils'

import { MOCK_PROPERTIES, type MockProperty } from './mock'

// Placeholder trend until real historical TTV data is wired in.
const MOCK_TREND = [65, 70, 68, 75, 78]

type LifecycleFilter = 'all' | 'onboarding' | 'activated' | 'archived'
type RiskFilter = 'all' | 'low' | 'medium' | 'high' | 'critical'
type View = 'table' | 'cards'

function ttvColor(score: number | null): string {
  if (score === null) return 'var(--color-muted)'
  if (score >= 85) return 'var(--color-success)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function daysSince(dateStr: string): number {
  const start = new Date(dateStr).getTime()
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function exportCsv(rows: MockProperty[]): void {
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
      p.city,
      p.lifecycle_state,
      p.phase_current ?? '',
      p.region,
      p.tech_owner,
      p.ttv_data ?? '',
      p.ttv_config ?? '',
      p.ttv_prov ?? '',
      p.ttv_overall ?? '',
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

  const regions = useMemo(
    () => Array.from(new Set(MOCK_PROPERTIES.map((p) => p.region))).sort(),
    [],
  )

  const filtered = useMemo(
    () =>
      MOCK_PROPERTIES.filter(
        (p) =>
          (lifecycle === 'all' || p.lifecycle_state === lifecycle) &&
          (region === 'all' || p.region === region) &&
          (risk === 'all' || p.risk === risk),
      ),
    [lifecycle, region, risk],
  )

  const total = MOCK_PROPERTIES.length
  const onboarding = MOCK_PROPERTIES.filter(
    (p) => p.lifecycle_state === 'onboarding',
  ).length
  const activated = MOCK_PROPERTIES.filter(
    (p) => p.lifecycle_state === 'activated',
  ).length
  const critical = MOCK_PROPERTIES.filter((p) => p.risk === 'critical').length
  const overalls = MOCK_PROPERTIES.map((p) => p.ttv_overall).filter(
    (v): v is number => v !== null,
  )
  const avgTtv = overalls.length
    ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
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
      {filtered.length === 0 ? (
        <EmptyState />
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
                      {p.region}
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
                    <span className="w-11 text-[11px] text-muted">Data</span>
                    <TTVBadge score={p.ttv_data} size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-11 text-[11px] text-muted">Config</span>
                    <TTVBadge score={p.ttv_config} size="sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-11 text-[11px] text-muted">Prov</span>
                    <TTVBadge score={p.ttv_prov} size="sm" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <LifecycleBadge state={p.lifecycle_state} />
                <PhaseBadge phase={p.phase_current} />
              </div>

              <TaskProgress complete={p.tasks_complete} total={p.tasks_total} />

              <div className="flex items-center justify-between border-t border-gray-50 pt-2.5 text-[11.5px] text-muted">
                <span>{p.tech_owner}</span>
                <span className="font-mono">{daysSince(p.start_date)}d</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
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
      <div className="mb-1.5 text-sm font-semibold text-gray-700">
        No properties match your filters
      </div>
      <div className="text-[13px] text-muted">Try adjusting your filters</div>
    </div>
  )
}
