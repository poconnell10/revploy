import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ConfirmDialog } from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'
import { AdminModal } from '../shared/AdminModal'

interface Brand {
  id: string
  code: string | null
  name: string
  created_at: string
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

export function BrandsPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)

  const query = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async (): Promise<Brand[]> => {
      const { data, error } = await supabase
        .from('brands')
        .select('id, code, name, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Brand[]
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-brands'] })
    queryClient.invalidateQueries({ queryKey: ['brands'] })
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setName('')
    setNameError(false)
  }

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from('brands')
          .update({ name })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { data: code, error: codeError } = await supabase.rpc(
          'generate_display_code',
          { p_prefix: 'BRD' },
        )
        if (codeError) throw codeError
        const { error } = await supabase.from('brands').insert({ code, name })
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
      const { error } = await supabase.from('brands').delete().eq('id', id)
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
    setNameError(false)
    setModalOpen(true)
  }
  const openEdit = (brand: Brand) => {
    setEditing(brand)
    setName(brand.name)
    setNameError(false)
    setModalOpen(true)
  }
  const submit = () => {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    upsert.mutate()
  }

  const brands = query.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">Brands</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-gold px-3.5 py-1.5 text-xs font-semibold text-navy transition-[filter] hover:brightness-95"
        >
          + Add Brand
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
        ) : brands.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm font-semibold text-gray-700">
            No brands yet
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-[#f8fafc]">
                <th className={TH_CLASS}>Code</th>
                <th className={TH_CLASS}>Name</th>
                <th className={TH_CLASS}>Created</th>
                <th className={`${TH_CLASS} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-b border-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-muted">
                      {brand.code ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">
                    {brand.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(brand.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(brand)}
                        className="rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(brand)}
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
        title={editing ? 'Edit Brand' : 'Add Brand'}
        onClose={closeModal}
        onSubmit={submit}
        isSubmitting={upsert.isPending}
      >
        <div>
          <label
            htmlFor="brand-name"
            className="mb-1.5 block text-[13px] font-medium text-gray-700"
          >
            Name
          </label>
          <input
            id="brand-name"
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
          {upsert.isError && (
            <p className="mt-1 text-xs text-danger">
              {getErrorMessage(upsert.error)}
            </p>
          )}
        </div>
      </AdminModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Brand"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
