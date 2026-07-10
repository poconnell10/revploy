import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  ConfirmDialog,
  CustomDropdown,
  type DropdownOption,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'
import { cn } from '@/shared/lib/utils'
import { AdminModal } from '../shared/AdminModal'

type OwnerType =
  'reit' | 'pe_fund' | 'independent' | 'other' | 'management_company'

interface Owner {
  id: string
  code: string | null
  name: string
  owner_type: OwnerType | null
  created_at: string
}

const OWNER_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'reit', label: 'REIT', dot: '#2563eb' },
  { value: 'pe_fund', label: 'PE Fund', dot: '#7c3aed' },
  { value: 'independent', label: 'Independent', dot: '#16a34a' },
  { value: 'management_company', label: 'Management Company', dot: '#0d1f3c' },
  { value: 'other', label: 'Other', dot: '#9aa3b2' },
]

const OWNER_TYPE_LABEL: Record<OwnerType, string> = {
  reit: 'REIT',
  pe_fund: 'PE Fund',
  independent: 'Independent',
  management_company: 'Management Company',
  other: 'Other',
}

const OWNER_TYPE_CLASS: Record<OwnerType, string> = {
  reit: 'bg-info-subtle text-info',
  pe_fund: 'bg-purple-subtle text-purple',
  independent: 'bg-success-subtle text-success',
  management_company: 'bg-gray-100 text-navy',
  other: 'bg-gray-50 text-muted',
}

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gold focus:ring-1 focus:ring-gold'
const TH_CLASS =
  'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted'

function formatDate(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
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

export function OwnersPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Owner | null>(null)
  const [name, setName] = useState('')
  const [ownerType, setOwnerType] = useState<OwnerType | ''>('')
  const [nameError, setNameError] = useState(false)
  const [typeError, setTypeError] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Owner | null>(null)

  const query = useQuery({
    queryKey: ['admin-owners'],
    queryFn: async (): Promise<Owner[]> => {
      const { data, error } = await supabase
        .from('owners')
        .select('id, code, name, owner_type, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Owner[]
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-owners'] })
    queryClient.invalidateQueries({ queryKey: ['owners'] })
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setName('')
    setOwnerType('')
    setNameError(false)
    setTypeError(false)
  }

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from('owners')
          .update({ name, owner_type: ownerType })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { data: code, error: codeError } = await supabase.rpc(
          'generate_display_code',
          { p_prefix: 'OWN' },
        )
        if (codeError) throw codeError
        const { error } = await supabase
          .from('owners')
          .insert({ code, name, owner_type: ownerType })
        if (error) throw error
      }
    },
    onSuccess: () => {
      invalidate()
      closeModal()
    },
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('owners').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      setDeleteTarget(null)
    },
  })

  const openCreate = () => {
    setEditing(null)
    setName('')
    setOwnerType('')
    setNameError(false)
    setTypeError(false)
    setModalOpen(true)
  }
  const openEdit = (owner: Owner) => {
    setEditing(owner)
    setName(owner.name)
    setOwnerType(owner.owner_type ?? '')
    setNameError(false)
    setTypeError(false)
    setModalOpen(true)
  }
  const submit = () => {
    const noName = !name.trim()
    const noType = ownerType === ''
    setNameError(noName)
    setTypeError(noType)
    if (noName || noType) return
    upsert.mutate()
  }

  const owners = query.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">Owners</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-navy transition-[filter] hover:brightness-95"
        >
          + Add Owner
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : owners.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm font-semibold text-gray-700">
            No owners yet
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-[#f8fafc]">
                <th className={TH_CLASS}>Code</th>
                <th className={TH_CLASS}>Name</th>
                <th className={TH_CLASS}>Type</th>
                <th className={TH_CLASS}>Created</th>
                <th className={`${TH_CLASS} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-muted">
                      {owner.code ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">
                    {owner.name}
                  </td>
                  <td className="px-4 py-3">
                    {owner.owner_type ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-[20px] px-2 py-0.5 text-[11px] font-semibold',
                          OWNER_TYPE_CLASS[owner.owner_type],
                        )}
                      >
                        {OWNER_TYPE_LABEL[owner.owner_type]}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(owner.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(owner)}
                        className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(owner)}
                        className="text-xs font-medium text-danger transition-colors hover:brightness-90"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminModal
        open={modalOpen}
        title={editing ? 'Edit Owner' : 'Add Owner'}
        onClose={closeModal}
        onSubmit={submit}
        isSubmitting={upsert.isPending}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="owner-name"
              className="mb-1.5 block text-[13px] font-medium text-gray-700"
            >
              Name
            </label>
            <input
              id="owner-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(false)
              }}
              className={INPUT_CLASS}
            />
            {nameError && (
              <p className="mt-1 text-xs text-danger">Name is required.</p>
            )}
          </div>
          <div>
            <label
              htmlFor="owner-type"
              className="mb-1.5 block text-[13px] font-medium text-gray-700"
            >
              Type
            </label>
            <CustomDropdown
              options={OWNER_TYPE_OPTIONS}
              value={ownerType}
              onChange={(v) => {
                setOwnerType(v as OwnerType | '')
                if (typeError) setTypeError(false)
              }}
              placeholder="Select type…"
              width="100%"
            />
            {typeError && (
              <p className="mt-1 text-xs text-danger">Type is required.</p>
            )}
          </div>
          {upsert.isError && (
            <p className="text-xs text-danger">
              {getErrorMessage(upsert.error)}
            </p>
          )}
        </div>
      </AdminModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Owner"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
