import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/shared/lib/supabase'

export type ProductKey = 'deskmax' | 'bookmax' | 'checkmax' | 'revmax'

export type ProductLifecycleState = 'onboarding' | 'activated' | 'archived'
export type ProductPhase = 'data' | 'configuration' | 'provisioning'

export interface Product {
  id: string
  product_key: ProductKey
  display_name: string
  description: string | null
  color: string
}

export interface PropertyProduct {
  id: string
  property_id: string
  product_id: string
  lifecycle_state: ProductLifecycleState
  phase_current: ProductPhase | null
  activation_date: string | null
  product: Product
}

/** The FPG product catalog (4 seeded products). */
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, product_key, display_name, description, color')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as Product[]
    },
  })
}

/** Products assigned to a property, each with its own lifecycle/phase. */
export function usePropertyProducts(propertyId: string) {
  return useQuery({
    queryKey: ['property-products', propertyId],
    enabled: !!propertyId,
    queryFn: async (): Promise<PropertyProduct[]> => {
      const { data, error } = await supabase
        .from('property_products')
        .select(
          'id, property_id, product_id, lifecycle_state, phase_current, activation_date, product:products(id, product_key, display_name, description, color)',
        )
        .eq('property_id', propertyId)
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as PropertyProduct[]
    },
  })
}

/** Single-letter badge for a product (D, B, R, C). */
export function productInitial(key: ProductKey): string {
  return key.charAt(0).toUpperCase()
}
