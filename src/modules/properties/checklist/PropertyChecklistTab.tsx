import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  RiskBadge,
  StatusBadge,
  type RiskLevel,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/shared/rbac/auth-context'
import { cn } from '@/shared/lib/utils'

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CHECKLIST_TOTAL_POINTS,
  DEPARTMENT_CLASS,
  DEPARTMENT_LABEL,
  pointsEarned,
  useChecklistItems,
  useProfiles,
  type ChecklistItem,
  type ChecklistStatus,
  type Department,
  type Profile,
} from './checklist-data'

const STATUS_OPTIONS: { value: ChecklistStatus; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'blocked', label: 'Blocked' },
]

const POINTS_BADGE_CLASS =
  'shrink-0 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400'
const FIELD_LABEL =
  'mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400'
const UNDERLINE_INPUT =
  'w-full border-0 border-b border-gray-100 bg-transparent px-0 py-1 text-[12px] text-gray-700 outline-none focus:border-gold'

function fmtPoints(n: number): string {
  return `${Number(n)}`
}

function deriveRisk(score: number): RiskLevel {
  if (score === 0) return 'critical'
  if (score >= 85) return 'low'
  if (score >= 50) return 'medium'
  return 'high'
}

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

// ---------------------------------------------------------------------------
// Shared controls (mirrors the Tasks tab pattern)
// ---------------------------------------------------------------------------

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

/** Status badge that opens a small dropdown menu to pick a new status. */
function StatusDropdown({
  status,
  onSelect,
}: {
  status: ChecklistStatus
  onSelect: (next: ChecklistStatus) => void
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
          className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-100 bg-white"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = opt.value === status
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  if (opt.value !== status) onSelect(opt.value)
                }}
                className={cn(
                  'flex h-8 w-full items-center px-4 text-left text-[13px] transition-colors',
                  active
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

/** Dropdown that lists every profile and assigns the item to the chosen one. */
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

// ---------------------------------------------------------------------------
// Item row — compact collapsed line + expandable detail
// ---------------------------------------------------------------------------

function ChecklistRow({
  item,
  isLast,
  profiles,
  getProfile,
  onStatus,
  onNotes,
  onPostNote,
  onAssign,
}: {
  item: ChecklistItem
  isLast: boolean
  profiles: Profile[]
  getProfile: (userId: string | null) => Profile | undefined
  onStatus: (item: ChecklistItem, next: ChecklistStatus) => void
  onNotes: (itemId: string, value: string) => void
  onPostNote: (itemId: string, value: string, itemName: string) => void
  onAssign: (itemId: string, profileId: string) => void
}) {
  const def = item.definition
  const [expanded, setExpanded] = useState(false)
  const [notesVal, setNotesVal] = useState<string>(item.notes ?? '')
  const [notePosted, setNotePosted] = useState(false)
  // Last-persisted note so blur doesn't re-save a value already saved/posted.
  const savedNoteRef = useRef<string>(item.notes ?? '')

  useEffect(() => {
    setNotesVal(item.notes ?? '')
    savedNoteRef.current = item.notes ?? ''
  }, [item.notes])

  const saveNote = () => {
    if (notesVal !== savedNoteRef.current) {
      savedNoteRef.current = notesVal
      onNotes(item.id, notesVal)
    }
  }

  const postNote = () => {
    savedNoteRef.current = notesVal
    onPostNote(item.id, notesVal, def.display_name)
    setNotePosted(true)
    window.setTimeout(() => setNotePosted(false), 2000)
  }

  const assigneeProfile = getProfile(item.assigned_to)
  const assigneeInitial = item.assigned_to
    ? (assigneeProfile?.avatar_initials ??
      item.assigned_to.charAt(0).toUpperCase())
    : null
  const assigneeName =
    assigneeProfile?.full_name ??
    (item.assigned_to ? `${item.assigned_to.slice(0, 18)}…` : null)

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid #f4f6f9' }}>
      {/* Collapsed single-line row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        className="flex h-12 cursor-pointer items-center gap-3 px-4"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
          {def.display_name}
        </span>
        <span className={POINTS_BADGE_CLASS}>{fmtPoints(def.points)} pts</span>
        {def.is_auto && (
          <span className="shrink-0 whitespace-nowrap rounded bg-info-subtle px-1.5 py-0.5 text-[10px] font-medium text-info">
            Auto
          </span>
        )}
        {assigneeInitial && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-[9px] font-bold text-navy">
            {assigneeInitial}
          </span>
        )}
        <StatusDropdown
          status={item.status}
          onSelect={(next) => onStatus(item, next)}
        />
        <span className="w-4 shrink-0 text-center text-sm text-muted">
          {expanded ? '▴' : '▾'}
        </span>
      </div>

      {/* Expanded 3-column detail */}
      {expanded && (
        <div
          className="grid grid-cols-1 gap-4 bg-gray-50 px-4 py-3 sm:grid-cols-3"
          style={{ borderTop: '1px solid #f4f6f9' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Assignee */}
          <div>
            <div className={FIELD_LABEL}>Assigned To</div>
            {item.assigned_to ? (
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
              onAssign={(profileId) => onAssign(item.id, profileId)}
            />
          </div>

          {/* Completed */}
          <div>
            <div className={FIELD_LABEL}>Completed</div>
            <div
              className={cn(
                'text-[12px]',
                item.status === 'complete' ? 'text-gray-700' : 'text-gray-400',
              )}
            >
              {item.status === 'complete'
                ? formatTimestamp(item.completed_at)
                : '—'}
            </div>
          </div>

          {/* Notes — blur saves silently; Post also broadcasts to the journal */}
          <div>
            <div className={FIELD_LABEL}>Notes</div>
            <textarea
              rows={2}
              value={notesVal}
              placeholder="Add a note..."
              onChange={(e) => setNotesVal(e.target.value)}
              onBlur={saveNote}
              className={cn(UNDERLINE_INPUT, 'resize-none bg-gray-50')}
            />
            <div className="mt-1 flex h-5 items-center gap-2">
              {notesVal.trim() && (
                <button
                  type="button"
                  onClick={postNote}
                  className="rounded bg-gold px-2 py-0.5 text-[11px] font-semibold text-navy transition-[filter] hover:brightness-95"
                >
                  Post
                </button>
              )}
              {notePosted && (
                <span className="text-[11px] font-medium text-success">
                  Posted ✓
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category section (collapsible, open by default)
// ---------------------------------------------------------------------------

function CategorySection({
  title,
  items,
  profiles,
  getProfile,
  onStatus,
  onNotes,
  onPostNote,
  onAssign,
}: {
  title: string
  items: ChecklistItem[]
  profiles: Profile[]
  getProfile: (userId: string | null) => Profile | undefined
  onStatus: (item: ChecklistItem, next: ChecklistStatus) => void
  onNotes: (itemId: string, value: string) => void
  onPostNote: (itemId: string, value: string, itemName: string) => void
  onAssign: (itemId: string, profileId: string) => void
}) {
  const [open, setOpen] = useState(true)

  const totalPoints = items.reduce(
    (sum, i) => sum + Number(i.definition.points),
    0,
  )
  const earned = pointsEarned(items)
  const completeCount = items.filter((i) => i.status === 'complete').length

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="w-3 shrink-0 text-sm text-muted">
          {open ? '▾' : '▸'}
        </span>
        <span className="flex-1 text-sm font-bold text-navy">{title}</span>
        <span className="shrink-0 font-mono text-xs text-gray-400">
          {fmtPoints(earned)}/{fmtPoints(totalPoints)} pts
        </span>
        <span className="shrink-0 text-xs text-gray-400">
          {completeCount} complete
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-50">
          {items.map((item, i) => (
            <ChecklistRow
              key={item.id}
              item={item}
              isLast={i === items.length - 1}
              profiles={profiles}
              getProfile={getProfile}
              onStatus={onStatus}
              onNotes={onNotes}
              onPostNote={onPostNote}
              onAssign={onAssign}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

export function PropertyChecklistTab({
  propertyId,
  propertyProductId,
}: {
  propertyId: string
  propertyProductId: string
}) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const query = useChecklistItems(propertyId, propertyProductId)
  const profilesQuery = useProfiles()

  const profiles = profilesQuery.data ?? []
  const getProfile = (userId: string | null) =>
    userId ? profiles.find((p) => p.id === userId) : undefined

  const checklistKey = ['checklist', propertyId, propertyProductId]

  const statusMutation = useMutation({
    mutationFn: async ({
      item,
      newStatus,
    }: {
      item: ChecklistItem
      newStatus: ChecklistStatus
    }) => {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        status: newStatus,
        updated_at: now,
        // Auto-assign to the signed-in user on any active status; clear on reset.
        assigned_to: newStatus === 'not_started' ? null : currentUserId,
        completed_at: newStatus === 'complete' ? now : null,
      }
      const { error } = await supabase
        .from('property_checklist_items')
        .update(patch)
        .eq('id', item.id)
      if (error) throw error
    },
    onMutate: async ({ item, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: checklistKey })
      const previous = queryClient.getQueryData<ChecklistItem[]>(checklistKey)
      // Optimistically patch so the score bar recomputes without a refetch.
      const optimistic: Partial<ChecklistItem> = {
        status: newStatus,
        assigned_to: newStatus === 'not_started' ? null : currentUserId,
        completed_at:
          newStatus === 'complete' ? new Date().toISOString() : null,
      }
      queryClient.setQueryData<ChecklistItem[]>(checklistKey, (old) =>
        old?.map((it) => (it.id === item.id ? { ...it, ...optimistic } : it)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(checklistKey, ctx.previous)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['checklist', propertyId] }),
  })

  // Silent operational save (on blur) — notes only, no journal entry.
  const notesMutation = useMutation({
    mutationFn: async ({
      itemId,
      value,
    }: {
      itemId: string
      value: string
    }) => {
      const { error } = await supabase
        .from('property_checklist_items')
        .update({ notes: value, updated_at: new Date().toISOString() })
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['checklist', propertyId] }),
  })

  // Explicit "Post" — saves the note AND broadcasts it to the property journal.
  const postNoteMutation = useMutation({
    mutationFn: async ({
      itemId,
      value,
      itemName,
    }: {
      itemId: string
      value: string
      itemName: string
    }) => {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('property_checklist_items')
        .update({ notes: value, updated_at: now })
        .eq('id', itemId)
      if (error) throw error

      const trimmed = value.trim()
      if (trimmed) {
        const { error: journalError } = await supabase
          .from('journal_entries')
          .insert({
            property_id: propertyId,
            author_id: currentUserId,
            entry_type: 'user_note',
            body: `[Checklist: ${itemName}] ${trimmed}`,
            customer_visible: false,
            parent_id: null,
          })
        if (journalError) throw journalError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', propertyId] })
      queryClient.invalidateQueries({ queryKey: ['journal', propertyId] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: async ({
      itemId,
      profileId,
    }: {
      itemId: string
      profileId: string
    }) => {
      const { error } = await supabase
        .from('property_checklist_items')
        .update({
          assigned_to: profileId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['checklist', propertyId] }),
  })

  const onStatus = (item: ChecklistItem, newStatus: ChecklistStatus) =>
    statusMutation.mutate({ item, newStatus })
  const onNotes = (itemId: string, value: string) =>
    notesMutation.mutate({ itemId, value })
  const onPostNote = (itemId: string, value: string, itemName: string) =>
    postNoteMutation.mutate({ itemId, value, itemName })
  const onAssign = (itemId: string, profileId: string) =>
    assignMutation.mutate({ itemId, profileId })

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-danger-subtle px-6 py-12 text-center">
        <div className="text-sm font-semibold text-danger">
          Could not load checklist
        </div>
        <div className="mt-1 text-[13px] text-danger">
          {query.error instanceof Error
            ? query.error.message
            : 'Please try again.'}
        </div>
      </div>
    )
  }

  const items = query.data ?? []
  const earned = pointsEarned(items)
  const score = Math.round((earned / CHECKLIST_TOTAL_POINTS) * 100)

  return (
    <div className="flex flex-col gap-5">
      {/* Operational Readiness score bar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Operational Readiness
        </div>
        <div className="flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gold transition-[width]"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold text-navy">
            {fmtPoints(earned)} / {CHECKLIST_TOTAL_POINTS} pts
          </span>
          <RiskBadge risk={deriveRisk(score)} />
        </div>
      </div>

      {/* Category sections */}
      {CATEGORY_ORDER.map((category) => {
        const inCategory = items.filter(
          (i) => i.definition.category === category,
        )
        if (inCategory.length === 0) return null
        return (
          <CategorySection
            key={category}
            title={CATEGORY_LABELS[category]}
            items={inCategory}
            profiles={profiles}
            getProfile={getProfile}
            onStatus={onStatus}
            onNotes={onNotes}
            onPostNote={onPostNote}
            onAssign={onAssign}
          />
        )
      })}
    </div>
  )
}
