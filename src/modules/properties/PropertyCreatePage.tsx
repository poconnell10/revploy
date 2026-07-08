import type { ReactNode } from 'react'
import { useForm, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useMutation,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
]

const schema = z.object({
  name: z.string().min(1, 'Property name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  room_count: z
    .number({ invalid_type_error: 'Room count is required' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1'),
  timezone: z.string().min(1, 'Timezone is required'),
  region_id: z.string().optional(),
  brand_id: z.string().optional(),
  owner_id: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  activation_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Entity {
  id: string
  name: string
}

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-1 focus:ring-gold'

function useEntities(table: 'regions' | 'brands' | 'owners') {
  return useQuery({
    queryKey: [table],
    queryFn: async (): Promise<Entity[]> => {
      const { data, error } = await supabase
        .from(table)
        .select('id, name')
        .order('name')
      if (error) throw error
      return (data ?? []) as Entity[]
    },
  })
}

function getErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message
  }
  return 'Failed to create property. Please try again.'
}

function SectionHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        'mb-4 border-b border-gray-100 pb-2 text-[13px] font-semibold uppercase tracking-wide text-navy',
        className,
      )}
    >
      {children}
    </h2>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[13px] font-medium text-gray-700"
      >
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

function EntitySelect({
  label,
  name,
  query,
  register,
}: {
  label: string
  name: 'region_id' | 'brand_id' | 'owner_id'
  query: UseQueryResult<Entity[]>
  register: UseFormRegister<FormValues>
}) {
  if (query.isLoading) {
    return (
      <Field label={label}>
        <div className="h-[42px] w-full animate-pulse rounded-lg bg-gray-100" />
      </Field>
    )
  }

  const items = query.data ?? []
  const empty = items.length === 0

  return (
    <Field label={label}>
      <select {...register(name)} disabled={empty} className={INPUT_CLASS}>
        {empty ? (
          <option value="">None available</option>
        ) : (
          <>
            <option value="">Select…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </>
        )}
      </select>
    </Field>
  )
}

export function PropertyCreatePage() {
  const navigate = useNavigate()
  const regions = useEntities('regions')
  const brands = useEntities('brands')
  const owners = useEntities('owners')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      city: '',
      country: '',
      timezone: '',
      region_id: '',
      brand_id: '',
      owner_id: '',
      start_date: '',
      activation_date: '',
    },
  })

  const createProperty = useMutation({
    mutationFn: async (values: FormValues): Promise<string> => {
      const { data: code, error: codeError } = await supabase.rpc(
        'generate_display_code',
        { p_prefix: 'PRP' },
      )
      if (codeError) throw codeError

      const { data: inserted, error: insertError } = await supabase
        .from('properties')
        .insert({
          code,
          name: values.name,
          city: values.city,
          country: values.country,
          room_count: values.room_count,
          timezone: values.timezone,
          region_id: values.region_id || null,
          brand_id: values.brand_id || null,
          owner_id: values.owner_id || null,
          start_date: values.start_date,
          activation_date: values.activation_date || null,
          lifecycle_state: 'onboarding',
          phase_current: 'data',
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      const propertyId = inserted.id as string
      const { error: tasksError } = await supabase.rpc(
        'create_property_tasks',
        {
          p_property_id: propertyId,
        },
      )
      if (tasksError) throw tasksError

      const { error: checklistError } = await supabase.rpc(
        'create_property_checklist_items',
        {
          p_property_id: propertyId,
        },
      )
      if (checklistError) throw checklistError

      return propertyId
    },
    onSuccess: (propertyId) => navigate(`/properties/${propertyId}`),
  })

  const onSubmit = handleSubmit((values) => createProperty.mutate(values))

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="transition-colors hover:text-gray-700"
          >
            Dashboard
          </button>
          <span className="text-[#d1d5db]">/</span>
          <span className="font-medium text-navy">Add Property</span>
        </div>
        <h1 className="mt-1 text-lg font-bold text-navy">Add Property</h1>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="rounded-xl border border-gray-100 bg-white p-8"
      >
        {/* Section 1 — Property Details */}
        <SectionHeading>Property Details</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Property Name"
            htmlFor="name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <input id="name" {...register('name')} className={INPUT_CLASS} />
          </Field>
          <Field label="City" htmlFor="city" error={errors.city?.message}>
            <input id="city" {...register('city')} className={INPUT_CLASS} />
          </Field>
          <Field
            label="Country"
            htmlFor="country"
            error={errors.country?.message}
          >
            <input
              id="country"
              {...register('country')}
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Room Count"
            htmlFor="room_count"
            error={errors.room_count?.message}
          >
            <input
              id="room_count"
              type="number"
              min={1}
              {...register('room_count', { valueAsNumber: true })}
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Timezone"
            htmlFor="timezone"
            error={errors.timezone?.message}
          >
            <select
              id="timezone"
              {...register('timezone')}
              className={INPUT_CLASS}
            >
              <option value="">Select timezone…</option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Section 2 — Assignment */}
        <SectionHeading className="mt-7">Assignment</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EntitySelect
            label="Region"
            name="region_id"
            query={regions}
            register={register}
          />
          <EntitySelect
            label="Brand"
            name="brand_id"
            query={brands}
            register={register}
          />
          <EntitySelect
            label="Owner"
            name="owner_id"
            query={owners}
            register={register}
          />
        </div>

        {/* Section 3 — Timeline */}
        <SectionHeading className="mt-7">Timeline</SectionHeading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Start Date"
            htmlFor="start_date"
            error={errors.start_date?.message}
          >
            <input
              id="start_date"
              type="date"
              {...register('start_date')}
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Target Activation Date"
            htmlFor="activation_date"
            error={errors.activation_date?.message}
          >
            <input
              id="activation_date"
              type="date"
              {...register('activation_date')}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {createProperty.isError && (
          <div className="mt-6 rounded-lg border border-[#fecaca] bg-danger-subtle px-4 py-3 text-[13px] text-danger">
            {getErrorMessage(createProperty.error)}
          </div>
        )}

        <div className="mt-7 flex items-center justify-end gap-2 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-md border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createProperty.isPending}
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy transition-[filter] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createProperty.isPending ? 'Creating…' : 'Create Property'}
          </button>
        </div>
      </form>
    </div>
  )
}
