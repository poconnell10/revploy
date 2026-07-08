import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  RiskBadge,
  StatusBadge,
  type RiskLevel,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CHECKLIST_TOTAL_POINTS,
  pointsEarned,
  useChecklistItems,
  type ChecklistItem,
  type ChecklistStatus,
} from './checklist-data'

// Cycle order for click-to-advance. Blocked falls back to not_started.
const NEXT_STATUS: Record<ChecklistStatus, ChecklistStatus> = {
  not_started: 'in_progress',
  in_progress: 'complete',
  complete: 'not_started',
  blocked: 'not_started',
}

function fmtPoints(n: number): string {
  return `${Number(n)}`
}

function deriveRisk(score: number): RiskLevel {
  if (score === 0) return 'critical'
  if (score >= 85) return 'low'
  if (score >= 50) return 'medium'
  return 'high'
}

const POINTS_BADGE_CLASS =
  'shrink-0 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-400'

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

function ChecklistRow({
  item,
  onCycle,
}: {
  item: ChecklistItem
  onCycle: (item: ChecklistItem, next: ChecklistStatus) => void
}) {
  const def = item.definition
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-gray-700">
          {def.display_name}
        </span>
        <span className={POINTS_BADGE_CLASS}>{fmtPoints(def.points)} pts</span>
        {def.is_auto && (
          <span className="shrink-0 whitespace-nowrap rounded bg-info-subtle px-1.5 py-0.5 text-[10px] font-medium text-info">
            Auto
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onCycle(item, NEXT_STATUS[item.status])}
        className="shrink-0 cursor-pointer"
      >
        <StatusBadge status={item.status} />
      </button>

      <span className="w-[88px] shrink-0 truncate text-right text-xs text-muted">
        {item.assigned_to ? `${item.assigned_to.slice(0, 8)}…` : 'Unassigned'}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category section (collapsible, open by default)
// ---------------------------------------------------------------------------

function CategorySection({
  title,
  items,
  onCycle,
}: {
  title: string
  items: ChecklistItem[]
  onCycle: (item: ChecklistItem, next: ChecklistStatus) => void
}) {
  const [open, setOpen] = useState(true)

  const totalPoints = items.reduce(
    (sum, i) => sum + Number(i.definition.points),
    0,
  )
  const earned = pointsEarned(items)
  const completeCount = items.filter((i) => i.status === 'complete').length

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
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
        <div className="flex flex-col gap-2 border-t border-gray-50 bg-gray-50/40 p-3">
          {items.map((item) => (
            <ChecklistRow key={item.id} item={item} onCycle={onCycle} />
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
  const query = useChecklistItems(propertyId, propertyProductId)

  const updateStatus = useMutation({
    mutationFn: async ({
      itemId,
      newStatus,
    }: {
      itemId: string
      newStatus: ChecklistStatus
    }) => {
      const patch: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }
      if (newStatus === 'complete')
        patch.completed_at = new Date().toISOString()
      const { error } = await supabase
        .from('property_checklist_items')
        .update(patch)
        .eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['checklist', propertyId] }),
  })

  const onCycle = (item: ChecklistItem, newStatus: ChecklistStatus) =>
    updateStatus.mutate({ itemId: item.id, newStatus })

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
            onCycle={onCycle}
          />
        )
      })}
    </div>
  )
}
