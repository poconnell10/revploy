import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  LifecycleBadge,
  PhaseBadge,
  PhaseGateBanner,
  RiskBadge,
  StatusBadge,
  TTVBadge,
  TTVDonut,
  type LifecycleState,
  type Phase,
  type RiskLevel,
  type TaskStatus,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

import { PropertyChecklistTab } from '../checklist/PropertyChecklistTab'
import { pointsEarned, useChecklistItems } from '../checklist/checklist-data'
import { PropertyJournalTab } from '../journal/PropertyJournalTab'
import { PropertySettingsTab } from './PropertySettingsTab'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropertyRow {
  id: string
  code: string
  name: string
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  salesforce_id: string | null
  ingauge_id: string | null
  room_count: number | null
  city: string | null
  country: string | null
  timezone: string | null
  start_date: string | null
  activation_date: string | null
  region_id: string | null
  brand_id: string | null
  owner_id: string | null
  region: { name: string } | null
  brand: { name: string } | null
  owner: { name: string } | null
}

interface TaskDefinition {
  task_key: string
  phase: Phase
  display_name: string
  required_role: string
  is_phase_gate: boolean
  completion_mode: string
  order_index: number
}

interface TaskRow {
  id: string
  status: TaskStatus
  assigned_to: string | null
  completed_at: string | null
  due_date: string | null
  blocked_reason: string | null
  definition: TaskDefinition
}

interface ContactRow {
  id: string
  user_id: string
  role_type: string
}

type Tab = 'overview' | 'tasks' | 'checklist' | 'journal' | 'settings'

const PHASE_HEX: Record<Phase, string> = {
  data: '#7c3aed',
  configuration: '#d97706',
  provisioning: '#2563eb',
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  not_started: 'in_progress',
  in_progress: 'complete',
  complete: 'not_started',
  blocked: 'not_started',
}

const PHASE_TASK_TOTAL: Record<Phase, number> = {
  data: 6,
  configuration: 8,
  provisioning: 6,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const start = new Date(`${dateStr}T00:00:00`).getTime()
  if (Number.isNaN(start)) return null
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000))
}

function formatDate(dateStr: string | null, withYear = true): string {
  if (!dateStr) return '—'
  const dt = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return dateStr
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

function ttvHex(score: number | null): string {
  if (score === null) return 'var(--color-muted)'
  if (score >= 85) return 'var(--color-success)'
  if (score >= 50) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return value.slice(0, 2).toUpperCase()
}

function deriveRisk(overall: number, anyStarted: boolean): RiskLevel {
  if (overall === 0 || !anyStarted) return 'critical'
  if (overall >= 85) return 'low'
  if (overall >= 50) return 'medium'
  return 'high'
}

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useProperty(id: string) {
  return useQuery({
    queryKey: ['property', id],
    enabled: !!id,
    queryFn: async (): Promise<PropertyRow> => {
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, code, name, lifecycle_state, phase_current, salesforce_id, ingauge_id, room_count, city, country, timezone, start_date, activation_date, region_id, brand_id, owner_id, region:regions(name), brand:brands(name), owner:owners(name)',
        )
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as PropertyRow
    },
  })
}

function useTasks(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    enabled: !!id,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from('property_lifecycle_tasks')
        .select(
          'id, status, assigned_to, completed_at, due_date, blocked_reason, definition:lifecycle_task_definitions(task_key, phase, display_name, required_role, is_phase_gate, completion_mode, order_index)',
        )
        .eq('property_id', id)
      if (error) throw error
      const rows = (data ?? []) as unknown as TaskRow[]
      return rows
        .slice()
        .sort((a, b) => a.definition.order_index - b.definition.order_index)
    },
  })
}

function useContacts(id: string) {
  return useQuery({
    queryKey: ['contacts', id],
    enabled: !!id,
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await supabase
        .from('property_contacts')
        .select('id, user_id, role_type')
        .eq('property_id', id)
        .eq('active', true)
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
  })
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
  )
}

function PropertyDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonBlock className="h-8 w-64" />
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-3">
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
        <SkeletonBlock className="h-32" />
      </div>
      <div className="grid grid-cols-[1fr_320px] gap-3">
        <SkeletonBlock className="h-52" />
        <SkeletonBlock className="h-52" />
      </div>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-gray-100 bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-subtle">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <div className="mb-1 text-sm font-semibold text-gray-700">
        Could not load property
      </div>
      <div className="text-[13px] text-muted">{message}</div>
    </div>
  )
}

function Avatar({ label, tone }: { label: string; tone: 'blue' | 'green' }) {
  return (
    <div
      className={cn(
        'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full',
        tone === 'blue'
          ? 'bg-info-subtle text-info'
          : 'bg-success-subtle text-success',
      )}
    >
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs font-medium text-gray-700">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------

function PhaseHeroCard({
  score,
  label,
}: {
  score: number | null
  label: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4">
      <TTVDonut score={score} size={48} />
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  )
}

function LifecycleStepper({ property }: { property: PropertyRow }) {
  const order: Phase[] = ['data', 'configuration', 'provisioning']
  const activated = property.lifecycle_state === 'activated'
  const curIdx = property.phase_current
    ? order.indexOf(property.phase_current)
    : -1

  const nodes = [
    {
      label: 'Data',
      phase: 'data' as Phase,
      done: activated || curIdx > 0,
      active: !activated && curIdx === 0,
    },
    {
      label: 'Config',
      phase: 'configuration' as Phase,
      done: activated || curIdx > 1,
      active: !activated && curIdx === 1,
    },
    {
      label: 'Prov',
      phase: 'provisioning' as Phase,
      done: activated || curIdx > 2,
      active: !activated && curIdx === 2,
    },
    { label: 'Activated', phase: null, done: activated, active: false },
  ]

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-5 text-xs font-semibold uppercase tracking-wide text-navy">
        Lifecycle Progress
      </div>
      <div className="flex items-start">
        {nodes.map((n, i) => {
          const color = n.done
            ? '#16a34a'
            : n.active && n.phase
              ? PHASE_HEX[n.phase]
              : '#9aa3b2'
          return (
            <div key={n.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{
                    background: n.done
                      ? '#16a34a'
                      : n.active
                        ? '#fff'
                        : '#e8ecf2',
                    border: n.active ? `2px solid ${color}` : 'none',
                  }}
                >
                  {n.done ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M13 4.5L6 11.5 3 8.5" />
                    </svg>
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: color }}
                    />
                  )}
                </div>
                <span
                  className="whitespace-nowrap text-[11px] font-medium"
                  style={{ color }}
                >
                  {n.label}
                </span>
              </div>
              {i < nodes.length - 1 && (
                <div
                  className="mx-1 mb-5 h-0.5 flex-1"
                  style={{ background: n.done ? '#16a34a' : '#e8ecf2' }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex gap-8 border-t border-gray-50 pt-4">
        <div>
          <div className="mb-0.5 text-[11px] text-muted">Salesforce ID</div>
          <div
            className="font-mono text-xs"
            style={{
              color: property.salesforce_id
                ? 'var(--color-gray-700)'
                : 'var(--color-muted)',
            }}
          >
            {property.salesforce_id ?? 'Not set'}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-[11px] text-muted">IN-Gauge ID</div>
          <div
            className="font-mono text-xs"
            style={{
              color: property.ingauge_id
                ? 'var(--color-gray-700)'
                : 'var(--color-muted)',
            }}
          >
            {property.ingauge_id ?? 'Not set'}
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamCard({
  property,
  contacts,
}: {
  property: PropertyRow
  contacts: ContactRow[]
}) {
  const tech = contacts.find((c) => c.role_type === 'tech_owner')
  const csc = contacts.find((c) => c.role_type === 'csc')

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-navy">
        Team
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar label={tech ? initials(tech.user_id) : '—'} tone="blue" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-navy">
              {tech ? `${tech.user_id.slice(0, 8)}…` : 'Unassigned'}
            </div>
            <div className="text-[11px] text-muted">Tech Owner</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Avatar label={csc ? initials(csc.user_id) : '—'} tone="green" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-navy">
              {csc ? `${csc.user_id.slice(0, 8)}…` : 'Unassigned'}
            </div>
            <div className="text-[11px] text-muted">CSC</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t border-gray-50 pt-3.5">
        <MetaRow label="Brand" value={property.brand?.name ?? '—'} />
        <MetaRow label="Region" value={property.region?.name ?? '—'} />
        <MetaRow label="Start Date" value={formatDate(property.start_date)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tasks tab
// ---------------------------------------------------------------------------

function TaskRowItem({
  task,
  gated,
  onCycle,
}: {
  task: TaskRow
  gated: boolean
  onCycle: (taskId: string, next: TaskStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const def = task.definition

  return (
    <div
      className="rounded-xl border border-gray-100 bg-white"
      style={{ opacity: gated ? 0.45 : 1 }}
    >
      <div
        onClick={() => !gated && setExpanded((v) => !v)}
        className="flex items-center gap-3 p-4"
        style={{ cursor: gated ? 'not-allowed' : 'pointer' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 text-sm font-medium text-navy">
            {def.display_name}
          </span>
          {def.is_phase_gate && (
            <span className="shrink-0 whitespace-nowrap rounded border border-[#fde8a5] bg-gold-light px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              Phase Gate
            </span>
          )}
          {def.completion_mode === 'auto_with_override' && (
            <span className="shrink-0 whitespace-nowrap rounded bg-info-subtle px-1.5 py-0.5 text-[10px] font-medium text-info">
              Auto
            </span>
          )}
          <span className="shrink-0 whitespace-nowrap rounded bg-gray-50 px-1.5 py-0.5 text-[10px] capitalize text-muted">
            {def.required_role}
          </span>
        </div>

        <button
          type="button"
          disabled={gated}
          onClick={(e) => {
            e.stopPropagation()
            if (!gated) onCycle(task.id, NEXT_STATUS[task.status])
          }}
          className={cn(
            'shrink-0',
            gated ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <StatusBadge status={task.status} />
        </button>

        <span className="w-[88px] shrink-0 truncate text-right text-xs text-muted">
          {task.assigned_to ? `${task.assigned_to.slice(0, 8)}…` : 'Unassigned'}
        </span>
        <span className="w-[60px] shrink-0 text-right font-mono text-[11px] text-muted">
          {task.due_date ? formatDate(task.due_date, false) : '—'}
        </span>
        <span className="w-4 shrink-0 text-center text-sm text-muted">
          {expanded ? '▴' : '▾'}
        </span>
      </div>

      {expanded && !gated && (
        <div className="border-t border-gray-50 bg-gray-50/60 px-4 py-3">
          {task.blocked_reason && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#fde68a] bg-warning-subtle px-3 py-2">
              <span className="text-warning">⚠</span>
              <span className="text-xs text-warning-strong">
                {task.blocked_reason}
              </span>
            </div>
          )}
          {task.completed_at ? (
            <div className="text-[11.5px] text-muted">
              Completed {formatDate(task.completed_at)}
            </div>
          ) : (
            <div className="text-[11.5px] text-muted">
              No additional details for this task yet.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PhaseSection({
  phase,
  title,
  score,
  tasks,
  gated,
  onCycle,
}: {
  phase: Phase
  title: string
  score: number | null
  tasks: TaskRow[]
  gated: boolean
  onCycle: (taskId: string, next: TaskStatus) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: PHASE_HEX[phase] }}
        />
        <span className="text-sm font-semibold text-navy">{title}</span>
        <TTVBadge score={score} size="sm" />
        <span className="text-xs text-muted">
          {PHASE_TASK_TOTAL[phase]} tasks
        </span>
        {gated && (
          <span className="flex items-center gap-1 rounded-[20px] bg-danger-subtle px-2 py-0.5 text-[11px] font-semibold text-danger">
            🔒 Locked
          </span>
        )}
      </div>
      {gated && phase !== 'data' && (
        <PhaseGateBanner phase={phase as 'configuration' | 'provisioning'} />
      )}
      {tasks.map((t) => (
        <TaskRowItem key={t.id} task={t} gated={gated} onCycle={onCycle} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PropertyDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')

  const propertyQuery = useProperty(id)
  const tasksQuery = useTasks(id)
  const contactsQuery = useContacts(id)
  const checklistQuery = useChecklistItems(id)

  const updateStatus = useMutation({
    mutationFn: async ({
      taskId,
      newStatus,
    }: {
      taskId: string
      newStatus: TaskStatus
    }) => {
      const patch: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'complete')
        patch.completed_at = new Date().toISOString()
      const { error } = await supabase
        .from('property_lifecycle_tasks')
        .update(patch)
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  if (propertyQuery.isLoading) {
    return <PropertyDetailSkeleton />
  }

  if (propertyQuery.isError || !propertyQuery.data) {
    const message =
      propertyQuery.error instanceof Error
        ? propertyQuery.error.message
        : 'This property may not exist or you may not have access.'
    return <ErrorCard message={message} />
  }

  const property = propertyQuery.data
  const tasks = tasksQuery.data ?? []

  const byPhase = (phase: Phase) =>
    tasks.filter((t) => t.definition.phase === phase)
  const completeIn = (rows: TaskRow[]) =>
    rows.filter((t) => t.status === 'complete').length
  const startedIn = (rows: TaskRow[]) =>
    rows.some((t) => t.status !== 'not_started')

  const dataTasks = byPhase('data')
  const configTasks = byPhase('configuration')
  const provTasks = byPhase('provisioning')

  const checklistItems = checklistQuery.data ?? []

  const dataTtv = Math.round((completeIn(dataTasks) / 6) * 100)
  const configTtv = startedIn(configTasks)
    ? Math.round((completeIn(configTasks) / 8) * 100)
    : null
  const provTtv = startedIn(provTasks)
    ? Math.round((completeIn(provTasks) / 6) * 100)
    : null

  const technicalTtv = Math.round((completeIn(tasks) / 20) * 100)
  const points = pointsEarned(checklistItems)
  const operationalTtv = Math.round((points / 100) * 100)
  const overallTtv = Math.round((technicalTtv + operationalTtv) / 2)

  const anyStarted =
    tasks.some((t) => t.status !== 'not_started') ||
    checklistItems.some((i) => i.status !== 'not_started')
  const risk = deriveRisk(overallTtv, anyStarted)

  const divComplete =
    tasks.find((t) => t.definition.task_key === 'data_integrity_validation')
      ?.status === 'complete'
  const configGated = !divComplete
  const allConfigComplete =
    configTasks.length > 0 && configTasks.every((t) => t.status === 'complete')
  const provGated = !allConfigComplete

  const onCycle = (taskId: string, newStatus: TaskStatus) =>
    updateStatus.mutate({ taskId, newStatus })

  const days = daysSince(property.start_date)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'journal', label: 'Journal' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <>
      {/* Header */}
      <div className="-mx-6 -mt-6 border-b border-gray-100 bg-white px-6 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            <Link
              to="/dashboard"
              className="transition-colors hover:text-gray-700"
            >
              Dashboard
            </Link>
            <span className="text-[#d1d5db]">/</span>
            <span className="truncate font-medium text-navy">
              {property.name}
            </span>
            <span className="shrink-0 rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {property.code}
            </span>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Actions ▾
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-navy">
                {property.name}
              </h2>
              <LifecycleBadge state={property.lifecycle_state} />
              <PhaseBadge phase={property.phase_current} />
            </div>
            <div className="mt-1 text-[13px] text-muted">
              {property.city ?? '—'} · {property.room_count ?? '—'} rooms ·{' '}
              {property.owner?.name ?? 'No owner'}
            </div>
          </div>
          <div className="flex shrink-0 gap-6">
            <div className="text-right">
              <div className="text-[11px] text-muted">Activation Date</div>
              <div className="font-mono text-[13px] font-semibold text-navy">
                {formatDate(property.activation_date)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted">Days Since Start</div>
              <div className="font-mono text-[13px] font-semibold text-navy">
                {days === null ? '—' : `${days}d`}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-[13px] transition-colors',
                tab === t.id
                  ? 'border-gold font-semibold text-navy'
                  : 'border-transparent font-normal text-muted hover:text-navy',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-6">
        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr] gap-3">
              {/* Overall */}
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
                <TTVDonut score={overallTtv} size={72} />
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                    Overall TTV
                  </div>
                  <div
                    className="font-mono text-2xl font-bold leading-none"
                    style={{ color: ttvHex(overallTtv) }}
                  >
                    {overallTtv}%
                  </div>
                  <div className="mt-2">
                    <RiskBadge risk={risk} />
                  </div>
                </div>
              </div>
              <PhaseHeroCard score={technicalTtv} label="Technical TTV" />
              <PhaseHeroCard score={operationalTtv} label="Operational TTV" />
              <PhaseHeroCard score={dataTtv} label="Data Phase" />
              <PhaseHeroCard score={configTtv} label="Config Phase" />
              <PhaseHeroCard score={provTtv} label="Prov Phase" />
            </div>

            <div className="grid grid-cols-[1fr_320px] gap-3">
              <LifecycleStepper property={property} />
              <TeamCard
                property={property}
                contacts={contactsQuery.data ?? []}
              />
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="flex flex-col gap-5">
            <PhaseSection
              phase="data"
              title="Data Phase"
              score={dataTtv}
              tasks={dataTasks}
              gated={false}
              onCycle={onCycle}
            />
            <PhaseSection
              phase="configuration"
              title="Configuration Phase"
              score={configTtv}
              tasks={configTasks}
              gated={configGated}
              onCycle={onCycle}
            />
            <PhaseSection
              phase="provisioning"
              title="Provisioning Phase"
              score={provTtv}
              tasks={provTasks}
              gated={provGated}
              onCycle={onCycle}
            />
          </div>
        )}

        {tab === 'checklist' && (
          <PropertyChecklistTab propertyId={property.id} />
        )}

        {tab === 'journal' && <PropertyJournalTab propertyId={property.id} />}

        {tab === 'settings' && <PropertySettingsTab property={property} />}
      </div>
    </>
  )
}
