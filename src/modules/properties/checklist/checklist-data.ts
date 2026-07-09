import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export type ChecklistCategory =
  | 'kickoff_calls'
  | 'products_revenue'
  | 'front_desk_sop'
  | 'elearning'
  | 'administrative'
  | 'ingauge_ops'

export type ChecklistStatus =
  'not_started' | 'in_progress' | 'complete' | 'blocked'

export interface ChecklistDefinition {
  item_key: string
  category: ChecklistCategory
  display_name: string
  description: string | null
  points: number
  is_auto: boolean
  order_index: number
}

export interface ChecklistItem {
  id: string
  status: ChecklistStatus
  assigned_to: string | null
  completed_at: string | null
  blocked_reason: string | null
  notes: string | null
  definition: ChecklistDefinition
}

/** Fixed display order for the six checklist categories. */
export const CATEGORY_ORDER: ChecklistCategory[] = [
  'kickoff_calls',
  'products_revenue',
  'front_desk_sop',
  'elearning',
  'administrative',
  'ingauge_ops',
]

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  kickoff_calls: 'Foundational Kick Off Calls',
  products_revenue: 'Products & Revenue Forecasts',
  front_desk_sop: 'Front Desk SOP & Data',
  elearning: 'E-Learning Status',
  administrative: 'Administrative',
  ingauge_ops: 'IN-Gauge Operational Checks',
}

/** Total points available across the whole checklist. */
export const CHECKLIST_TOTAL_POINTS = 100

/**
 * Load a property's checklist items joined to their definitions, ordered by the
 * definition order_index. Shared cache key so the detail page hero cards and the
 * checklist tab read from a single fetch.
 */
export function useChecklistItems(
  propertyId: string,
  propertyProductId?: string,
) {
  return useQuery({
    queryKey: ['checklist', propertyId, propertyProductId],
    enabled: !!propertyId && !!propertyProductId,
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await supabase
        .from('property_checklist_items')
        .select(
          'id, status, assigned_to, completed_at, blocked_reason, notes, definition:operational_checklist_definitions(item_key, category, display_name, description, points, is_auto, order_index)',
        )
        .eq('property_id', propertyId)
        .eq('property_product_id', propertyProductId as string)
      if (error) throw error
      const rows = (data ?? []) as unknown as ChecklistItem[]
      return rows
        .slice()
        .sort((a, b) => a.definition.order_index - b.definition.order_index)
    },
  })
}

/** Sum of points for items whose status is 'complete'. */
export function pointsEarned(items: ChecklistItem[]): number {
  return items
    .filter((i) => i.status === 'complete')
    .reduce((sum, i) => sum + Number(i.definition.points), 0)
}

// ---------------------------------------------------------------------------
// Profiles (shared shape with the Tasks tab) so assignees show real names.
// ---------------------------------------------------------------------------

export type Department = 'tech' | 'operations' | 'sales' | 'customer_success'

export interface Profile {
  id: string
  full_name: string
  email: string
  department: Department | null
  avatar_initials: string | null
}

export const DEPARTMENT_LABEL: Record<Department, string> = {
  tech: 'Tech',
  operations: 'Operations',
  sales: 'Sales',
  customer_success: 'Customer Success',
}

export const DEPARTMENT_CLASS: Record<Department, string> = {
  tech: 'bg-info-subtle text-info',
  operations: 'bg-purple-subtle text-purple',
  sales: 'bg-warning-subtle text-warning',
  customer_success: 'bg-success-subtle text-success',
}

export function useProfiles() {
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
