import { useEffect, useState } from 'react'
import { useForm, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '@/shared/components/primitives'
import { useAuth } from '@/shared/rbac/auth-context'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'

export interface SettingsProperty {
  id: string
  name: string
  city: string | null
  country: string | null
  room_count: number | null
  timezone: string | null
  start_date: string | null
  salesforce_id: string | null
  ingauge_id: string | null
  region_id: string | null
  brand_id: string | null
  owner_id: string | null
  region: { name: string } | null
  brand: { name: string } | null
  owner: { name: string } | null
}

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

const detailsSchema = z.object({
  name: z.string().min(1, 'Property name is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  room_count: z
    .number({ invalid_type_error: 'Room count is required' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1'),
  timezone: z.string().min(1, 'Timezone is required'),
  start_date: z.string().min(1, 'Start date is required'),
  region_id: z.string().optional(),
  brand_id: z.string().optional(),
  owner_id: z.string().optional(),
})

type DetailsValues = z.infer<typeof detailsSchema>

interface Entity {
  id: string
  name: string
}

const CARD_CLASS = 'rounded-xl border bg-white p-6'
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-1 focus:ring-gold'
const EDIT_LABEL_CLASS = 'mb-1.5 block text-[13px] font-medium text-gray-700'

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const dt = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return dateStr
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
  return 'Something went wrong. Please try again.'
}

// ---------------------------------------------------------------------------
// Card 1 — Property Details
// ---------------------------------------------------------------------------

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[13px] text-muted">{label}</div>
      <div className="text-sm text-gray-700">{value}</div>
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
  register: UseFormRegister<DetailsValues>
}) {
  if (query.isLoading) {
    return (
      <div>
        <label className={EDIT_LABEL_CLASS}>{label}</label>
        <div className="h-[42px] w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
    )
  }
  const items = query.data ?? []
  const empty = items.length === 0
  return (
    <div>
      <label className={EDIT_LABEL_CLASS}>{label}</label>
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
    </div>
  )
}

function PropertyDetailsCard({ property }: { property: SettingsProperty }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const regions = useEntities('regions')
  const brands = useEntities('brands')
  const owners = useEntities('owners')

  const defaults: DetailsValues = {
    name: property.name,
    city: property.city ?? '',
    country: property.country ?? '',
    room_count: property.room_count ?? 0,
    timezone: property.timezone ?? '',
    start_date: property.start_date ?? '',
    region_id: property.region_id ?? '',
    brand_id: property.brand_id ?? '',
    owner_id: property.owner_id ?? '',
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: defaults,
  })

  const save = useMutation({
    mutationFn: async (values: DetailsValues) => {
      const { error } = await supabase
        .from('properties')
        .update({
          name: values.name,
          city: values.city,
          country: values.country,
          room_count: values.room_count,
          timezone: values.timezone,
          start_date: values.start_date,
          region_id: values.region_id || null,
          brand_id: values.brand_id || null,
          owner_id: values.owner_id || null,
        })
        .eq('id', property.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', property.id] })
      setEditing(false)
    },
  })

  const onSubmit = handleSubmit((values) => save.mutate(values))

  const startEdit = () => {
    reset(defaults)
    setEditing(true)
  }
  const cancel = () => {
    reset(defaults)
    setEditing(false)
  }

  return (
    <div className={cn(CARD_CLASS, 'border-gray-100')}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-navy">Property Details</h3>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-name" className={EDIT_LABEL_CLASS}>
                Property Name
              </label>
              <input
                id="s-name"
                {...register('name')}
                className={INPUT_CLASS}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-danger">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="s-city" className={EDIT_LABEL_CLASS}>
                City
              </label>
              <input
                id="s-city"
                {...register('city')}
                className={INPUT_CLASS}
              />
              {errors.city && (
                <p className="mt-1 text-xs text-danger">
                  {errors.city.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="s-country" className={EDIT_LABEL_CLASS}>
                Country
              </label>
              <input
                id="s-country"
                {...register('country')}
                className={INPUT_CLASS}
              />
              {errors.country && (
                <p className="mt-1 text-xs text-danger">
                  {errors.country.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="s-rooms" className={EDIT_LABEL_CLASS}>
                Room Count
              </label>
              <input
                id="s-rooms"
                type="number"
                min={1}
                {...register('room_count', { valueAsNumber: true })}
                className={INPUT_CLASS}
              />
              {errors.room_count && (
                <p className="mt-1 text-xs text-danger">
                  {errors.room_count.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="s-tz" className={EDIT_LABEL_CLASS}>
                Timezone
              </label>
              <select
                id="s-tz"
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
              {errors.timezone && (
                <p className="mt-1 text-xs text-danger">
                  {errors.timezone.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="s-start" className={EDIT_LABEL_CLASS}>
                Start Date
              </label>
              <input
                id="s-start"
                type="date"
                {...register('start_date')}
                className={INPUT_CLASS}
              />
              {errors.start_date && (
                <p className="mt-1 text-xs text-danger">
                  {errors.start_date.message}
                </p>
              )}
            </div>
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
            <EntitySelect
              label="Region"
              name="region_id"
              query={regions}
              register={register}
            />
          </div>

          {save.isError && (
            <p className="text-xs text-danger">{getErrorMessage(save.error)}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy transition-[filter] hover:brightness-95 disabled:opacity-60"
            >
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <ReadField label="Property Name" value={property.name} />
          <ReadField label="City" value={property.city ?? '—'} />
          <ReadField label="Country" value={property.country ?? '—'} />
          <ReadField
            label="Room Count"
            value={property.room_count?.toString() ?? '—'}
          />
          <ReadField label="Timezone" value={property.timezone ?? '—'} />
          <ReadField
            label="Start Date"
            value={formatDate(property.start_date)}
          />
          <ReadField label="Brand" value={property.brand?.name ?? '—'} />
          <ReadField label="Owner" value={property.owner?.name ?? '—'} />
          <ReadField label="Region" value={property.region?.name ?? '—'} />
          <div />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card 2 — External System IDs
// ---------------------------------------------------------------------------

function InlineIdField({
  label,
  field,
  value,
  propertyId,
}: {
  label: string
  field: 'salesforce_id' | 'ingauge_id'
  value: string | null
  propertyId: string
}) {
  const queryClient = useQueryClient()
  const original = value ?? ''
  const [text, setText] = useState(original)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(original)
  }, [original, editing])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('properties')
        .update({ [field]: text.trim() || null })
        .eq('id', propertyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] })
      setEditing(false)
    },
  })

  const dirty = text !== original
  const showActions = editing || dirty

  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
        {label}
      </label>
      <input
        value={text}
        placeholder="Not set"
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-lg border border-gray-100 bg-white px-3 py-2.5 font-mono text-sm text-gray-700 outline-none placeholder:not-italic placeholder:text-muted focus:border-gold focus:ring-1 focus:ring-gold"
      />
      {save.isError && (
        <p className="mt-1 text-xs text-danger">
          {getErrorMessage(save.error)}
        </p>
      )}
      {showActions && (
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setText(original)
              setEditing(false)
            }}
            className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate()}
            className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-navy transition-[filter] hover:brightness-95 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}

function ExternalIdsCard({ property }: { property: SettingsProperty }) {
  const missing = !property.salesforce_id || !property.ingauge_id
  return (
    <div className={cn(CARD_CLASS, 'border-gray-100')}>
      <h3 className="mb-4 text-[15px] font-bold text-navy">
        External System IDs
      </h3>
      <div className="flex flex-col gap-4">
        <InlineIdField
          label="Salesforce ID"
          field="salesforce_id"
          value={property.salesforce_id}
          propertyId={property.id}
        />
        <InlineIdField
          label="IN-Gauge ID"
          field="ingauge_id"
          value={property.ingauge_id}
          propertyId={property.id}
        />
      </div>
      {missing && (
        <div className="mt-4 rounded-lg border border-warning-border bg-warning-subtle px-3.5 py-2.5 text-[13px] text-warning-strong">
          ⚠ Both Salesforce ID and IN-Gauge ID must be set before this property
          can be activated.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card 3 — Danger Zone
// ---------------------------------------------------------------------------

function DangerZoneCard({ property }: { property: SettingsProperty }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('properties')
        .update({
          archived_at: new Date().toISOString(),
          lifecycle_state: 'archived',
        })
        .eq('id', property.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-properties'] })
      navigate('/dashboard')
    },
  })

  return (
    <div className={cn(CARD_CLASS, 'border-[#fecaca]')}>
      <h3 className="text-[15px] font-bold text-danger">Danger Zone</h3>
      <p className="mb-4 mt-1 text-[13px] text-muted">
        Archiving a property removes it from the active dashboard. This can be
        reversed by an admin.
      </p>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-md border border-danger bg-white px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-subtle"
      >
        Archive Property
      </button>
      {archive.isError && (
        <p className="mt-2 text-xs text-danger">
          {getErrorMessage(archive.error)}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Archive Property"
        description={`This will archive ${property.name}. The property will no longer appear in the active dashboard. This action can be reversed by an admin.`}
        confirmLabel="Archive"
        confirmVariant="danger"
        onConfirm={() => archive.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

export function PropertySettingsTab({
  property,
}: {
  property: SettingsProperty
}) {
  const { role } = useAuth()

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-4">
      <PropertyDetailsCard property={property} />
      <ExternalIdsCard property={property} />
      {role === 'admin' && <DangerZoneCard property={property} />}
    </div>
  )
}
