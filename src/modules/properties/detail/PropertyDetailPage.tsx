import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
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
import { useAuth } from '@/shared/rbac/auth-context'
import { usePropertyProducts } from '@/shared/products/products'
import { cn } from '@/shared/lib/utils'

import { PropertyActions } from './PropertyActions'
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
  description: string | null
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
  notes: string | null
  definition: TaskDefinition
}

interface ContactRow {
  id: string
  user_id: string
  role_type: string
}

type Department = 'tech' | 'operations' | 'sales' | 'customer_success'

interface Profile {
  id: string
  full_name: string
  email: string
  department: Department | null
  avatar_initials: string | null
}

const DEPARTMENT_LABEL: Record<Department, string> = {
  tech: 'Tech',
  operations: 'Operations',
  sales: 'Sales',
  customer_success: 'Customer Success',
}

const DEPARTMENT_CLASS: Record<Department, string> = {
  tech: 'bg-info-subtle text-info',
  operations: 'bg-purple-subtle text-purple',
  sales: 'bg-warning-subtle text-warning',
  customer_success: 'bg-success-subtle text-success',
}

type Tab = 'overview' | 'tasks' | 'checklist' | 'journal' | 'settings'

// Phase dot colors — kept distinct from product colors (DeskMax is #7c3aed).
const PHASE_HEX: Record<Phase, string> = {
  data: '#0891b2',
  configuration: '#d97706',
  provisioning: '#2563eb',
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

/** Format a full timestamptz (e.g. completed_at) as "Jul 7, 2026". */
function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Today as an ISO date string (YYYY-MM-DD) for date columns/inputs. */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
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

function useTasks(id: string, propertyProductId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id, propertyProductId],
    enabled: !!id && !!propertyProductId,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from('property_lifecycle_tasks')
        .select(
          'id, property_product_id, status, assigned_to, completed_at, due_date, blocked_reason, notes, definition:lifecycle_task_definitions(task_key, phase, display_name, description, required_role, is_phase_gate, completion_mode, order_index)',
        )
        .eq('property_id', id)
        .eq('property_product_id', propertyProductId as string)
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

function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, avatar_initials')
      if (error) throw error
      return (data ?? []) as Profile[]
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
// Tasks tab — enhanced interactive rows (status dropdown, assignee, dates,
// notes) shared by all three phases
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'blocked', label: 'Blocked' },
]

const DATA_FIELD_LABEL =
  'mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400'
// Compact underline-style inputs for the expanded detail row.
const UNDERLINE_INPUT =
  'w-full border-0 border-b border-gray-100 bg-transparent px-0 py-1 text-[12px] text-gray-700 outline-none focus:border-gold'

/** Status badge that opens a small dropdown menu to pick a new status. */
function StatusDropdown({
  status,
  disabled,
  onSelect,
}: {
  status: TaskStatus
  /** Per-status disabled reason; when present the option is greyed with a tooltip. */
  disabled?: Partial<Record<TaskStatus, string>>
  onSelect: (next: TaskStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="cursor-pointer"
      >
        <StatusBadge status={status} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-100 bg-white"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.value === status
            const disabledReason = disabled?.[opt.value]
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!!disabledReason}
                title={disabledReason}
                onClick={(e) => {
                  e.stopPropagation()
                  if (disabledReason) return
                  setOpen(false)
                  if (opt.value !== status) onSelect(opt.value)
                }}
                className={cn(
                  'flex h-8 w-full items-center px-4 text-left text-[13px] transition-colors',
                  disabledReason
                    ? 'cursor-not-allowed text-gray-300'
                    : active
                      ? 'bg-gold-light font-semibold text-warning'
                      : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DepartmentChip({ department }: { department: Department | null }) {
  if (!department) return null
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium',
        DEPARTMENT_CLASS[department],
      )}
    >
      {DEPARTMENT_LABEL[department]}
    </span>
  )
}

/** Dropdown that lists every profile and assigns the task to the chosen one. */
function AssignPicker({
  profiles,
  onAssign,
}: {
  profiles: Profile[]
  onAssign: (profileId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative mt-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="rounded-md border border-gray-100 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        Assign →
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-20 mt-1 max-h-56 w-60 overflow-auto rounded-lg border border-gray-100 bg-white"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        >
          {profiles.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-muted">
              No profiles found
            </div>
          ) : (
            profiles.map((pf) => (
              <button
                key={pf.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  onAssign(pf.id)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
                  {pf.avatar_initials ?? pf.full_name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-gray-700">
                  {pf.full_name}
                </span>
                <DepartmentChip department={pf.department} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function EnhancedTaskRow({
  task,
  isLast,
  gated,
  isAdmin,
  currentUserId,
  profiles,
  getProfile,
  onStatus,
  onDueDate,
  onNotes,
  onBlockedReason,
  onAssign,
}: {
  task: TaskRow
  isLast: boolean
  gated: boolean
  isAdmin: boolean
  currentUserId: string | null
  profiles: Profile[]
  getProfile: (userId: string | null) => Profile | undefined
  onStatus: (task: TaskRow, next: TaskStatus) => void
  onDueDate: (taskId: string, date: string) => void
  onNotes: (taskId: string, value: string, taskName: string) => void
  onBlockedReason: (taskId: string, value: string) => void
  onAssign: (taskId: string, profileId: string) => void
}) {
  const def = task.definition
  const [expanded, setExpanded] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [dateVal, setDateVal] = useState<string>(task.due_date ?? todayStr())
  const [notesVal, setNotesVal] = useState<string>(task.notes ?? '')
  const [blockedVal, setBlockedVal] = useState<string>(
    task.blocked_reason ?? '',
  )
  const [noteSaved, setNoteSaved] = useState(false)
  // Tracks the last-persisted note so blur + Post don't double-save/double-post.
  const savedNoteRef = useRef<string>(task.notes ?? '')

  const isAuto = def.completion_mode === 'auto_with_override'
  // The activation-readiness gate may only be completed by an admin.
  const isActivationGate = def.task_key === 'prov_activation_readiness'
  const adminOnlyComplete = isActivationGate && !isAdmin

  // Complete requires an assignee: either a signed-in user (auto-assigned) or
  // an already-assigned user. Otherwise the option is blocked.
  const completeBlocked = !currentUserId && !task.assigned_to
  const completeDisabledReason = completeBlocked
    ? 'Sign in required'
    : adminOnlyComplete
      ? 'Admin only'
      : undefined

  const saveNote = (confirm: boolean) => {
    if (notesVal !== savedNoteRef.current) {
      savedNoteRef.current = notesVal
      onNotes(task.id, notesVal, def.display_name)
    }
    if (confirm) {
      setNoteSaved(true)
      window.setTimeout(() => setNoteSaved(false), 2000)
    }
  }

  const handleSelect = (next: TaskStatus) => {
    if (next === 'complete' && completeBlocked) {
      setStatusError(
        'Cannot complete task — no user session found. Please sign in again.',
      )
      return
    }
    if (next === 'complete' && adminOnlyComplete) {
      setStatusError('Only an admin can complete this task.')
      return
    }
    setStatusError(null)
    onStatus(task, next)
  }

  useEffect(() => {
    if (task.due_date) setDateVal(task.due_date)
  }, [task.due_date])
  useEffect(() => {
    setNotesVal(task.notes ?? '')
    savedNoteRef.current = task.notes ?? ''
  }, [task.notes])
  useEffect(() => {
    setBlockedVal(task.blocked_reason ?? '')
  }, [task.blocked_reason])

  // Resolve the assignee to a real profile when available; fall back to the
  // raw UUID so pre-profiles assignments still render something.
  const assigneeProfile = getProfile(task.assigned_to)
  const assigneeInitial = task.assigned_to
    ? (assigneeProfile?.avatar_initials ??
      task.assigned_to.charAt(0).toUpperCase())
    : null
  const assigneeName =
    assigneeProfile?.full_name ??
    (task.assigned_to ? `${task.assigned_to.slice(0, 18)}…` : null)

  return (
    <div
      style={{
        borderBottom: isLast ? 'none' : '1px solid #f4f6f9',
        opacity: gated ? 0.45 : 1,
      }}
    >
      {/* Collapsed row: name + description left, controls right */}
      <div
        onClick={() => !gated && setExpanded((v) => !v)}
        className="flex items-center gap-3 px-4 py-2.5"
        style={{ cursor: gated ? 'not-allowed' : 'pointer' }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-navy">
            {def.display_name}
          </div>
          {def.description?.trim() && !expanded && (
            <div className="mt-0.5 max-w-[600px] truncate text-[11px] font-normal text-gray-400">
              {def.description}
            </div>
          )}
          {def.description?.trim() && expanded && (
            <div className="mt-0.5 max-w-[600px] text-[11px] font-normal leading-snug text-gray-400">
              {def.description}
            </div>
          )}
        </div>
        {def.is_phase_gate && (
          <span className="shrink-0 whitespace-nowrap rounded border border-[#fde8a5] bg-gold-light px-1.5 py-0.5 text-[10px] font-semibold text-warning">
            Phase Gate
          </span>
        )}
        {isAuto && (
          <span className="shrink-0 whitespace-nowrap rounded bg-info-subtle px-1.5 py-0.5 text-[10px] font-medium text-info">
            Auto
          </span>
        )}
        <span className="shrink-0 whitespace-nowrap rounded bg-gray-50 px-1.5 py-0.5 text-[11px] capitalize text-muted">
          {def.required_role}
        </span>
        {assigneeInitial && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-navy">
            {assigneeInitial}
          </span>
        )}
        {gated ? (
          <StatusBadge status={task.status} />
        ) : (
          <StatusDropdown
            status={task.status}
            disabled={
              completeDisabledReason
                ? { complete: completeDisabledReason }
                : undefined
            }
            onSelect={handleSelect}
          />
        )}
        <span className="w-[64px] shrink-0 text-right font-mono text-[12px] text-gray-400">
          {task.due_date ? formatDate(task.due_date, false) : '—'}
        </span>
        <span className="w-4 shrink-0 text-center text-sm text-muted">
          {gated ? '🔒' : expanded ? '▴' : '▾'}
        </span>
      </div>

      {/* Blocked-complete guard error */}
      {!gated && statusError && (
        <div
          className="px-4 pb-2 text-[12px] font-medium text-danger"
          onClick={(e) => e.stopPropagation()}
        >
          {statusError}
        </div>
      )}

      {/* Blocked reason inline input */}
      {!gated && task.status === 'blocked' && (
        <div
          className="px-4 pb-3"
          style={{ borderTop: '1px solid #f4f6f9' }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={blockedVal}
            placeholder="Describe the blocker..."
            onChange={(e) => setBlockedVal(e.target.value)}
            onBlur={() => {
              if ((task.blocked_reason ?? '') !== blockedVal)
                onBlockedReason(task.id, blockedVal)
            }}
            className="mt-2 w-full rounded-lg border border-[#fde68a] bg-warning-subtle px-3 py-2 text-[12px] text-warning-strong outline-none focus:border-warning"
          />
        </div>
      )}

      {/* Expanded 3-column detail */}
      {!gated && expanded && (
        <div
          className="grid grid-cols-1 gap-4 bg-gray-50 px-4 py-3 sm:grid-cols-3"
          style={{ borderTop: '1px solid #f4f6f9' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Assignee */}
          <div>
            <div className={DATA_FIELD_LABEL}>Assigned To</div>
            {task.assigned_to ? (
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-navy">
                  {assigneeInitial}
                </span>
                <span className="min-w-0 truncate text-[12px] text-gray-700">
                  {assigneeName}
                </span>
                <DepartmentChip
                  department={assigneeProfile?.department ?? null}
                />
              </div>
            ) : (
              <div className="text-[12px] text-muted">Unassigned</div>
            )}
            <AssignPicker
              profiles={profiles}
              onAssign={(profileId) => onAssign(task.id, profileId)}
            />
          </div>

          {/* Dates */}
          <div>
            <div className={DATA_FIELD_LABEL}>Start Date</div>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => {
                setDateVal(e.target.value)
                onDueDate(task.id, e.target.value)
              }}
              className={UNDERLINE_INPUT}
            />
            <div className={cn(DATA_FIELD_LABEL, 'mt-2')}>Completed</div>
            <div
              className={cn(
                'text-[12px]',
                task.status === 'complete' ? 'text-gray-700' : 'text-gray-400',
              )}
            >
              {task.status === 'complete'
                ? formatTimestamp(task.completed_at)
                : '—'}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className={DATA_FIELD_LABEL}>Notes</div>
            <textarea
              rows={2}
              value={notesVal}
              placeholder="Add a note..."
              onChange={(e) => setNotesVal(e.target.value)}
              onBlur={() => saveNote(false)}
              className={cn(UNDERLINE_INPUT, 'resize-none bg-gray-50')}
            />
            <div className="mt-1 flex h-5 items-center gap-2">
              {notesVal.trim() && (
                <button
                  type="button"
                  onClick={() => saveNote(true)}
                  className="rounded bg-gold px-2 py-0.5 text-[11px] font-semibold text-navy transition-[filter] hover:brightness-95"
                >
                  Post
                </button>
              )}
              {noteSaved && (
                <span className="text-[11px] font-medium text-success">
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EnhancedPhaseSection({
  phase,
  title,
  score,
  tasks,
  gated,
  isAdmin,
  currentUserId,
  profiles,
  getProfile,
  onStatus,
  onDueDate,
  onNotes,
  onBlockedReason,
  onAssign,
  headerAction,
}: {
  phase: Phase
  title: string
  score: number | null
  tasks: TaskRow[]
  gated: boolean
  isAdmin: boolean
  currentUserId: string | null
  profiles: Profile[]
  getProfile: (userId: string | null) => Profile | undefined
  onStatus: (task: TaskRow, next: TaskStatus) => void
  onDueDate: (taskId: string, date: string) => void
  onNotes: (taskId: string, value: string, taskName: string) => void
  onBlockedReason: (taskId: string, value: string) => void
  onAssign: (taskId: string, profileId: string) => void
  headerAction?: ReactNode
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
        {headerAction && <div className="ml-auto">{headerAction}</div>}
      </div>
      {gated && phase !== 'data' && (
        <PhaseGateBanner phase={phase as 'configuration' | 'provisioning'} />
      )}
      <div className="rounded-xl border border-gray-100 bg-white">
        {tasks.map((t, i) => (
          <EnhancedTaskRow
            key={t.id}
            task={t}
            isLast={i === tasks.length - 1}
            gated={gated}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            profiles={profiles}
            getProfile={getProfile}
            onStatus={onStatus}
            onDueDate={onDueDate}
            onNotes={onNotes}
            onBlockedReason={onBlockedReason}
            onAssign={onAssign}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PropertyDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { user, role } = useAuth()
  const currentUserId = user?.id ?? null
  const isAdmin = role === 'admin'
  const [tab, setTab] = useState<Tab>('overview')
  // Dev/testing only: hides phase-gate locks in the UI. The DB triggers still
  // enforce gating, so a disallowed transition is simply rejected on save.
  // Component-state only — resets on reload.
  const [testingMode, setTestingMode] = useState(false)
  const [ingestToast, setIngestToast] = useState<string | null>(null)
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [ingestLoading, setIngestLoading] = useState(false)

  // Seeding warnings passed from the create flow (e.g. tasks/checklist RPC
  // failed after the property was created). Dismissible; shown once.
  const seedWarnings =
    (location.state as { seedWarnings?: string[] } | null)?.seedWarnings ?? []
  const [warningsDismissed, setWarningsDismissed] = useState(false)

  const propertyQuery = useProperty(id)
  const contactsQuery = useContacts(id)
  const productsQuery = usePropertyProducts(id)
  const profilesQuery = useProfiles()

  const profiles = profilesQuery.data ?? []
  const getProfile = (userId: string | null) =>
    userId ? profiles.find((p) => p.id === userId) : undefined

  const propertyProducts = productsQuery.data ?? []
  const [selectedProductId, setSelectedProductId] = useState<string>()

  // Reset the manual selection whenever the property changes — the route
  // reuses this component across properties, so a selection from a previous
  // property must not leak into the next one.
  useEffect(() => {
    setSelectedProductId(undefined)
  }, [id])

  // Honour the manual selection only while it still belongs to this property;
  // otherwise fall back to the first product. Keeps the switcher self-correcting.
  const activeProductId =
    selectedProductId &&
    propertyProducts.some((pp) => pp.id === selectedProductId)
      ? selectedProductId
      : propertyProducts[0]?.id
  const activeProduct = propertyProducts.find((pp) => pp.id === activeProductId)

  const tasksQuery = useTasks(id, activeProductId)
  const checklistQuery = useChecklistItems(id, activeProductId)

  // Task status change: applies the full transition rules (assignee / due date
  // / completed metadata) and optimistically patches the cache so the phase TTV
  // badges recompute immediately. Shared across all three phases.
  const tasksKey = ['tasks', id, activeProductId]
  const dataStatusMutation = useMutation({
    mutationFn: async ({
      task,
      newStatus,
      uid,
    }: {
      task: TaskRow
      newStatus: TaskStatus
      uid: string | null
    }) => {
      // Hard rule: a task cannot be completed without an assignee. Prefer the
      // signed-in user; fall back to whoever is already assigned.
      const assignee = uid ?? task.assigned_to
      if (newStatus === 'complete' && !assignee) {
        throw new Error(
          'Cannot complete task — no user session found. Please sign in again.',
        )
      }
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        status: newStatus,
        updated_at: now,
      }
      if (newStatus === 'not_started') {
        patch.assigned_to = null
        patch.due_date = null
        patch.completed_at = null
        patch.completed_by = null
        patch.blocked_reason = null
      } else {
        // Auto-assign on every non-not_started status change.
        patch.assigned_to = assignee
        if (task.status === 'not_started' && newStatus === 'in_progress') {
          patch.due_date = todayStr()
        }
        if (newStatus === 'complete') {
          // Explicitly (re)assert the assignee on completion — never rely on a
          // prior transition having set it.
          patch.assigned_to = assignee
          patch.completed_at = now
          patch.completed_by = assignee
        }
        if (task.status === 'complete' && newStatus !== 'complete') {
          patch.completed_at = null
          patch.completed_by = null
        }
      }
      const { error } = await supabase
        .from('property_lifecycle_tasks')
        .update(patch)
        .eq('id', task.id)
      if (error) throw error
    },
    onMutate: async ({ task, newStatus, uid }) => {
      await queryClient.cancelQueries({ queryKey: tasksKey })
      const previous = queryClient.getQueryData<TaskRow[]>(tasksKey)
      const assignee = uid ?? task.assigned_to
      const optimistic: Partial<TaskRow> = { status: newStatus }
      if (newStatus === 'not_started') {
        optimistic.assigned_to = null
        optimistic.due_date = null
        optimistic.completed_at = null
        optimistic.blocked_reason = null
      } else {
        // Reflect the assignment immediately, without waiting for a refetch.
        optimistic.assigned_to = assignee
        if (task.status === 'not_started' && newStatus === 'in_progress')
          optimistic.due_date = todayStr()
        if (newStatus === 'complete')
          optimistic.completed_at = new Date().toISOString()
        if (task.status === 'complete' && newStatus !== 'complete')
          optimistic.completed_at = null
      }
      queryClient.setQueryData<TaskRow[]>(tasksKey, (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, ...optimistic } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(tasksKey, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const dueDateMutation = useMutation({
    mutationFn: async ({ taskId, date }: { taskId: string; date: string }) => {
      const { error } = await supabase
        .from('property_lifecycle_tasks')
        .update({
          due_date: date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const blockedReasonMutation = useMutation({
    mutationFn: async ({
      taskId,
      value,
    }: {
      taskId: string
      value: string
    }) => {
      const { error } = await supabase
        .from('property_lifecycle_tasks')
        .update({
          blocked_reason: value || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const assignMutation = useMutation({
    mutationFn: async ({
      taskId,
      profileId,
    }: {
      taskId: string
      profileId: string
    }) => {
      const { error } = await supabase
        .from('property_lifecycle_tasks')
        .update({
          assigned_to: profileId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  // Saving a task note also drops a linked entry into the property journal.
  const notesMutation = useMutation({
    mutationFn: async ({
      taskId,
      value,
      taskName,
    }: {
      taskId: string
      value: string
      taskName: string
    }) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('property_lifecycle_tasks')
        .update({ notes: value, updated_at: now })
        .eq('id', taskId)
      if (error) throw error

      const trimmed = value.trim()
      if (trimmed) {
        const { error: journalError } = await supabase
          .from('journal_entries')
          .insert({
            property_id: id,
            author_id: currentUserId,
            entry_type: 'user_note',
            body: `[Task: ${taskName}] ${trimmed}`,
            customer_visible: false,
            parent_id: null,
          })
        if (journalError) throw journalError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      queryClient.invalidateQueries({ queryKey: ['journal', id] })
    },
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

  const simulateIngest = async () => {
    setIngestError(null)
    setIngestLoading(true)
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-callback`
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          property_code: property.code,
          s3_bucket: `fpg-revploy-${property.code.toLowerCase()}-ingest`,
          source: 'manual_test',
        }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
      }
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Ingest failed (${res.status})`)
      }
      await queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      setIngestToast('Data Ingestion triggered')
      window.setTimeout(() => setIngestToast(null), 2500)
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : String(err))
    } finally {
      setIngestLoading(false)
    }
  }

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

  // Whether the current phase's gate requirements are met (for the Advance
  // Lifecycle action; the actual gate is still enforced by DB triggers).
  const provReadinessComplete =
    tasks.find((t) => t.definition.task_key === 'prov_activation_readiness')
      ?.status === 'complete'
  const gatesMet =
    property.lifecycle_state !== 'onboarding'
      ? true
      : property.phase_current === 'data'
        ? divComplete
        : property.phase_current === 'configuration'
          ? allConfigComplete
          : property.phase_current === 'provisioning'
            ? Boolean(
                provReadinessComplete &&
                property.salesforce_id &&
                property.ingauge_id,
              )
            : true
  const canManage = role === 'admin' || role === 'manager'

  const onTaskStatus = (task: TaskRow, newStatus: TaskStatus) =>
    dataStatusMutation.mutate({ task, newStatus, uid: currentUserId })
  const onTaskDueDate = (taskId: string, date: string) =>
    dueDateMutation.mutate({ taskId, date })
  const onTaskNotes = (taskId: string, value: string, taskName: string) =>
    notesMutation.mutate({ taskId, value, taskName })
  const onTaskBlockedReason = (taskId: string, value: string) =>
    blockedReasonMutation.mutate({ taskId, value })
  const onTaskAssign = (taskId: string, profileId: string) =>
    assignMutation.mutate({ taskId, profileId })

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
          {canManage && (
            <PropertyActions
              property={property}
              contacts={contactsQuery.data ?? []}
              profiles={profiles}
              gatesMet={gatesMet}
              isAdmin={isAdmin}
            />
          )}
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

        {/* Product switcher (the only interactive product control) */}
        {propertyProducts.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-4 border-b border-gray-50 pb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Viewing
            </span>
            {propertyProducts.map((pp) => {
              const active = pp.id === activeProductId
              return (
                <button
                  key={pp.id}
                  type="button"
                  onClick={() => setSelectedProductId(pp.id)}
                  className={cn(
                    '-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 pb-1.5 text-xs font-semibold transition-colors',
                    active
                      ? ''
                      : 'border-transparent text-gray-400 hover:text-navy',
                  )}
                  style={
                    active
                      ? {
                          borderColor: pp.product.color,
                          color: pp.product.color,
                        }
                      : undefined
                  }
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: pp.product.color }}
                  />
                  {pp.product.display_name}
                </button>
              )
            })}
          </div>
        )}

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
        {seedWarnings.length > 0 && !warningsDismissed && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning-border bg-warning-subtle px-4 py-3">
            <span className="shrink-0 text-warning">⚠</span>
            <div className="flex-1 text-[13px] text-warning-strong">
              {seedWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setWarningsDismissed(true)}
              className="shrink-0 text-xs font-medium text-warning-strong transition-opacity hover:opacity-70"
            >
              Dismiss
            </button>
          </div>
        )}

        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            {activeProduct && (
              <div className="flex items-center gap-2 text-[13px] font-semibold text-navy">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: activeProduct.product.color }}
                />
                {activeProduct.product.display_name} Performance
              </div>
            )}
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
            {/* Dev/testing toggle — UI-only phase-gate bypass */}
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => setTestingMode((v) => !v)}
                title="Testing tool — hides gate locks in the UI only"
                className={cn(
                  'rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors',
                  testingMode
                    ? 'bg-[#fef3c7] text-[#d97706]'
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100',
                )}
              >
                {testingMode ? 'Testing Mode ON' : 'Testing Mode'}
              </button>
              {testingMode && (
                <span className="text-[11px] font-medium text-[#d97706]">
                  ⚠ Gate locks hidden for testing
                </span>
              )}
            </div>
            <EnhancedPhaseSection
              phase="data"
              title="Data Phase"
              score={dataTtv}
              tasks={dataTasks}
              gated={false}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              profiles={profiles}
              getProfile={getProfile}
              onStatus={onTaskStatus}
              onDueDate={onTaskDueDate}
              onNotes={onTaskNotes}
              onBlockedReason={onTaskBlockedReason}
              onAssign={onTaskAssign}
              headerAction={
                testingMode ? (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => void simulateIngest()}
                      disabled={ingestLoading}
                      className="rounded-md border border-[#f59e0b] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#d97706] transition-colors hover:bg-[#fffbeb] disabled:opacity-60"
                    >
                      {ingestLoading ? 'Triggering…' : '⚡ Simulate S3 Trigger'}
                    </button>
                    {ingestError && (
                      <span className="max-w-[240px] text-right text-[11px] font-medium text-danger">
                        {ingestError}
                      </span>
                    )}
                  </div>
                ) : undefined
              }
            />
            <EnhancedPhaseSection
              phase="configuration"
              title="Configuration Phase"
              score={configTtv}
              tasks={configTasks}
              gated={testingMode ? false : configGated}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              profiles={profiles}
              getProfile={getProfile}
              onStatus={onTaskStatus}
              onDueDate={onTaskDueDate}
              onNotes={onTaskNotes}
              onBlockedReason={onTaskBlockedReason}
              onAssign={onTaskAssign}
            />
            <EnhancedPhaseSection
              phase="provisioning"
              title="Provisioning Phase"
              score={provTtv}
              tasks={provTasks}
              gated={testingMode ? false : provGated}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              profiles={profiles}
              getProfile={getProfile}
              onStatus={onTaskStatus}
              onDueDate={onTaskDueDate}
              onNotes={onTaskNotes}
              onBlockedReason={onTaskBlockedReason}
              onAssign={onTaskAssign}
            />
          </div>
        )}

        {tab === 'checklist' &&
          (activeProductId ? (
            <PropertyChecklistTab
              propertyId={property.id}
              propertyProductId={activeProductId}
            />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white px-6 py-14 text-center text-[13px] text-muted">
              No products assigned to this property.
            </div>
          ))}

        {tab === 'journal' && <PropertyJournalTab propertyId={property.id} />}

        {tab === 'settings' && <PropertySettingsTab property={property} />}
      </div>

      {ingestToast && (
        <div
          className="fixed bottom-7 left-1/2 z-[999] -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-navy px-5 py-2.5 text-[13px] font-medium text-white"
          style={{ animation: 'actionModalFadeUp 0.2s ease' }}
        >
          ✓ {ingestToast}
        </div>
      )}
    </>
  )
}
