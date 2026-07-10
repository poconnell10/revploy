import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  CustomDropdown,
  LifecycleBadge,
  PhaseBadge,
  type DropdownOption,
  type LifecycleState,
  type Phase,
} from '@/shared/components/primitives'
import { supabase } from '@/shared/lib/supabase'

import { ActionModal } from './ActionModal'

interface ActionProperty {
  id: string
  name: string
  code: string
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  activation_date: string | null
}

interface ActionContact {
  id: string
  user_id: string
  role_type: string
}

interface ActionProfile {
  id: string
  full_name: string
  department: string | null
  avatar_initials: string | null
}

const DEPARTMENT_COLOR: Record<string, { bg: string; text: string }> = {
  tech: { bg: '#ede9fe', text: '#7c3aed' },
  operations: { bg: '#fef3c7', text: '#d97706' },
  sales: { bg: '#dbeafe', text: '#2563eb' },
  customer_success: { bg: '#dcfce7', text: '#16a34a' },
}

const DEPARTMENT_LABEL: Record<string, string> = {
  tech: 'Tech',
  operations: 'Operations',
  sales: 'Sales',
  customer_success: 'Customer Success',
}

function departmentColor(department: string | null): {
  bg: string
  text: string
} {
  return (
    DEPARTMENT_COLOR[department ?? ''] ?? { bg: '#f4f6f9', text: '#9aa3b2' }
  )
}

function nameInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

type ModalId = 'advance' | 'setdate' | 'tech' | 'csc' | 'archive'

const BTN =
  'rounded-lg border border-gray-100 bg-gray-50 px-[18px] py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-100'
const BTN_PRIMARY =
  'rounded-lg border border-gold bg-gold px-[18px] py-2 text-[13px] font-semibold text-navy transition-[filter] hover:brightness-95'
const BTN_DANGER =
  'rounded-lg border border-[#dc2626] bg-[#dc2626] px-[18px] py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#b91c1c]'
const INPUT =
  'w-full rounded-lg border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-700 outline-none focus:border-gold'
const MODAL_LABEL = 'mb-1.5 block text-[12px] font-semibold text-gray-700'

const PHASE_SEQ: Phase[] = ['data', 'configuration', 'provisioning']
const PHASE_LABEL: Record<Phase, string> = {
  data: 'Data',
  configuration: 'Configuration',
  provisioning: 'Provisioning',
}

interface NextState {
  lifecycle_state: LifecycleState
  phase_current: Phase | null
  label: string
}

/** Next lifecycle target, or null when the property is already activated. */
function computeAdvance(property: ActionProperty): NextState | null {
  if (property.lifecycle_state === 'activated') return null
  const idx = property.phase_current
    ? PHASE_SEQ.indexOf(property.phase_current)
    : 0
  if (idx < PHASE_SEQ.length - 1) {
    const next = PHASE_SEQ[idx + 1]
    return {
      lifecycle_state: 'onboarding',
      phase_current: next,
      label: PHASE_LABEL[next],
    }
  }
  return {
    lifecycle_state: 'activated',
    phase_current: null,
    label: 'Activated',
  }
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

export function PropertyActions({
  property,
  contacts,
  profiles,
  gatesMet,
  isAdmin,
}: {
  property: ActionProperty
  contacts: ActionContact[]
  profiles: ActionProfile[]
  gatesMet: boolean
  isAdmin: boolean
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<ModalId | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [dateVal, setDateVal] = useState('')
  const [reassignTo, setReassignTo] = useState('')

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const getProfile = (userId: string | null) =>
    userId ? profiles.find((p) => p.id === userId) : undefined
  const profileName = (userId: string | null) =>
    getProfile(userId)?.full_name ??
    (userId ? `${userId.slice(0, 8)}…` : 'Unassigned')
  const profileInitial = (userId: string | null) => {
    const pf = getProfile(userId)
    if (pf) return pf.avatar_initials ?? pf.full_name.charAt(0).toUpperCase()
    return userId ? userId.charAt(0).toUpperCase() : '—'
  }

  const techContact = contacts.find((c) => c.role_type === 'tech_owner')
  const cscContact = contacts.find((c) => c.role_type === 'csc')

  const openModal = (id: ModalId) => {
    setMenuOpen(false)
    setReassignTo('')
    if (id === 'setdate') setDateVal(property.activation_date ?? '')
    advanceMutation.reset()
    setModal(id)
  }
  const closeModal = () => setModal(null)

  // --- Mutations --------------------------------------------------------------

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const next = computeAdvance(property)
      if (!next) return null
      const patch: Record<string, unknown> = {
        phase_current: next.phase_current,
        updated_at: new Date().toISOString(),
      }
      if (next.lifecycle_state === 'activated')
        patch.lifecycle_state = 'activated'
      const { error } = await supabase
        .from('properties')
        .update(patch)
        .eq('id', property.id)
      if (error) throw error
      return next.label
    },
    onSuccess: (label) => {
      queryClient.invalidateQueries({ queryKey: ['property', property.id] })
      closeModal()
      if (label) showToast(`Phase advanced to ${label}`)
    },
  })

  const dateMutation = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('properties')
        .update({
          activation_date: date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', property.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', property.id] })
      closeModal()
      showToast('Activation date updated')
    },
  })

  const reassignMutation = useMutation({
    mutationFn: async ({
      role,
      userId,
    }: {
      role: 'tech_owner' | 'csc'
      userId: string
    }) => {
      const existing = contacts.find((c) => c.role_type === role)
      if (existing) {
        const { error } = await supabase
          .from('property_contacts')
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('property_contacts').insert({
          property_id: property.id,
          user_id: userId,
          role_type: role,
          active: true,
        })
        if (error) throw error
      }
    },
    onSuccess: (_data, { role }) => {
      queryClient.invalidateQueries({ queryKey: ['property', property.id] })
      queryClient.invalidateQueries({ queryKey: ['contacts', property.id] })
      closeModal()
      showToast(
        role === 'tech_owner' ? 'Tech Owner reassigned' : 'CSC reassigned',
      )
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('properties')
        .update({
          archived_at: new Date().toISOString(),
          lifecycle_state: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', property.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property', property.id] })
      navigate('/dashboard')
    },
  })

  const nameStrong = <strong className="text-gray-700">{property.name}</strong>
  const next = computeAdvance(property)

  const MENU_ITEM =
    'flex w-full items-center px-4 py-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-50'

  return (
    <>
      {/* Trigger + dropdown */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          Actions ▾
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-gray-100 bg-white py-1"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
          >
            <button
              type="button"
              className={MENU_ITEM}
              onClick={() => openModal('advance')}
            >
              Advance Lifecycle State
            </button>
            <button
              type="button"
              className={MENU_ITEM}
              onClick={() => openModal('setdate')}
            >
              Set Activation Date
            </button>
            <button
              type="button"
              className={MENU_ITEM}
              onClick={() => openModal('tech')}
            >
              Reassign Tech Owner
            </button>
            <button
              type="button"
              className={MENU_ITEM}
              onClick={() => openModal('csc')}
            >
              Reassign CSC
            </button>
            {isAdmin && (
              <>
                <div className="my-1 h-px bg-gray-50" />
                <button
                  type="button"
                  className="flex w-full items-center px-4 py-2 text-left text-[13px] font-medium text-[#dc2626] transition-colors hover:bg-[#fff5f5]"
                  onClick={() => openModal('archive')}
                >
                  Archive Property
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 1. Advance Lifecycle State */}
      <ActionModal
        open={modal === 'advance'}
        onClose={closeModal}
        title="Advance Lifecycle State"
        description={
          <>
            Move {nameStrong} to the next lifecycle phase. This action is logged
            and cannot be undone.
          </>
        }
        footer={
          next ? (
            <>
              <button type="button" className={BTN} onClick={closeModal}>
                Cancel
              </button>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={advanceMutation.isPending}
                onClick={() => advanceMutation.mutate()}
              >
                {advanceMutation.isPending ? 'Advancing…' : 'Confirm Advance'}
              </button>
            </>
          ) : (
            <button type="button" className={BTN} onClick={closeModal}>
              Close
            </button>
          )
        }
      >
        {next ? (
          <>
            <div className="mb-5 flex items-center gap-4 rounded-[10px] border border-gray-100 bg-[#f8fafc] p-4">
              <div className="flex-1 text-center">
                <div className="mb-1.5 text-[11px] text-gray-400">Current</div>
                <LifecycleBadge state={property.lifecycle_state} />
                {property.phase_current && (
                  <div className="mt-1.5">
                    <PhaseBadge phase={property.phase_current} />
                  </div>
                )}
              </div>
              <div className="text-xl text-[#c0ccd8]">→</div>
              <div className="flex-1 text-center">
                <div className="mb-1.5 text-[11px] text-gray-400">Next</div>
                <LifecycleBadge state={next.lifecycle_state} />
                {next.phase_current && (
                  <div className="mt-1.5">
                    <PhaseBadge phase={next.phase_current} />
                  </div>
                )}
              </div>
            </div>
            {!gatesMet && (
              <div className="mb-5 rounded-lg border border-[#fde68a] bg-[#fef3c7] px-3.5 py-2.5 text-[12.5px] text-[#d97706]">
                Some phase requirements are not yet complete. You can still
                advance manually.
              </div>
            )}
            {advanceMutation.isError && (
              <div className="mb-4 rounded-lg border border-[#fecaca] bg-danger-subtle px-3.5 py-2.5 text-[12.5px] text-danger">
                {getErrorMessage(advanceMutation.error)}
              </div>
            )}
          </>
        ) : (
          <div className="mb-5 rounded-[10px] border border-gray-100 bg-[#f8fafc] p-4 text-center text-[13px] text-gray-700">
            Property is already activated
          </div>
        )}
      </ActionModal>

      {/* 2. Set Activation Date */}
      <ActionModal
        open={modal === 'setdate'}
        onClose={closeModal}
        title="Set Activation Date"
        description={<>Update the target activation date for {nameStrong}.</>}
        footer={
          <>
            <button type="button" className={BTN} onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={dateMutation.isPending}
              onClick={() => dateMutation.mutate(dateVal)}
            >
              {dateMutation.isPending ? 'Saving…' : 'Save Date'}
            </button>
          </>
        }
      >
        <div className="mb-5">
          <label className={MODAL_LABEL} htmlFor="activation-date">
            Target Activation Date
          </label>
          <input
            id="activation-date"
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className={INPUT}
          />
          <div className="mt-1.5 text-[11.5px] text-gray-400">
            Current:{' '}
            <span className="font-mono text-gray-700">
              {property.activation_date ?? 'Not set'}
            </span>
          </div>
        </div>
      </ActionModal>

      {/* 3 & 4. Reassign Tech Owner / CSC */}
      <ActionModal
        open={modal === 'tech' || modal === 'csc'}
        onClose={closeModal}
        title={modal === 'csc' ? 'Reassign CSC' : 'Reassign Tech Owner'}
        description={
          modal === 'csc' ? (
            <>Transfer the Customer Success Contact for {nameStrong}.</>
          ) : (
            <>Transfer ownership of {nameStrong} to a different Tech Owner.</>
          )
        }
        footer={
          <>
            <button type="button" className={BTN} onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={!reassignTo || reassignMutation.isPending}
              onClick={() =>
                reassignMutation.mutate({
                  role: modal === 'csc' ? 'csc' : 'tech_owner',
                  userId: reassignTo,
                })
              }
            >
              {reassignMutation.isPending ? 'Reassigning…' : 'Reassign'}
            </button>
          </>
        }
      >
        {(() => {
          const isCsc = modal === 'csc'
          const current = isCsc ? cscContact : techContact
          const avatarClass = isCsc
            ? 'bg-[#dcfce7] text-[#16a34a]'
            : 'bg-[#dbeafe] text-[#2563eb]'
          const available = profiles.filter((p) => p.id !== current?.user_id)
          const personOptions: DropdownOption[] = available.map((p) => {
            const c = departmentColor(p.department)
            return {
              value: p.id,
              label: p.full_name,
              sub: p.department
                ? (DEPARTMENT_LABEL[p.department] ?? p.department)
                : undefined,
              initials: nameInitials(p.full_name),
              avatarBg: c.bg,
              avatarColor: c.text,
            }
          })
          return (
            <div className="mb-5">
              <label className={MODAL_LABEL}>
                {isCsc ? 'Current CSC' : 'Current Tech Owner'}
              </label>
              <div className="mb-3.5 flex items-center gap-2.5 rounded-lg border border-gray-100 bg-[#f8fafc] px-3 py-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarClass}`}
                >
                  {current ? profileInitial(current.user_id) : '—'}
                </span>
                <span className="text-[13px] font-medium text-gray-700">
                  {current ? profileName(current.user_id) : 'Unassigned'}
                </span>
              </div>
              <label className={MODAL_LABEL}>Reassign To</label>
              <CustomDropdown
                options={personOptions}
                value={reassignTo}
                onChange={setReassignTo}
                placeholder={isCsc ? 'Select CSC…' : 'Select Tech Owner…'}
                width="100%"
              />
            </div>
          )
        })()}
      </ActionModal>

      {/* 5. Archive Property */}
      <ActionModal
        open={modal === 'archive'}
        onClose={closeModal}
        title="Archive Property"
        titleVariant="danger"
        description={
          <>
            You are about to archive {nameStrong} ({property.code}). This will:
          </>
        }
        footer={
          <>
            <button type="button" className={BTN} onClick={closeModal}>
              Cancel
            </button>
            <button
              type="button"
              className={BTN_DANGER}
              disabled={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              {archiveMutation.isPending ? 'Archiving…' : 'Archive Property'}
            </button>
          </>
        }
      >
        <div className="-mt-2 mb-3.5 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#fee2e2]">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18v2a1 1 0 01-1 1H4a1 1 0 01-1-1V6z" />
            <path d="M5 9v11h14V9" />
            <path d="M10 13h4" />
          </svg>
        </div>
        <ul className="mb-4 list-disc pl-[18px] text-[13px] leading-[2.1] text-[#6b7280]">
          <li>Remove it from active onboarding operations</li>
          <li>Freeze all task and TTV scoring</li>
          <li>Retain all historical data and event logs</li>
        </ul>
        <div className="mb-5 rounded-lg border border-[#fde68a] bg-[#fef3c7] px-3.5 py-2.5 text-[12.5px] text-[#d97706]">
          ⚠ This action is irreversible. The property cannot be reactivated once
          archived.
        </div>
        {archiveMutation.isError && (
          <div className="mb-4 rounded-lg border border-[#fecaca] bg-danger-subtle px-3.5 py-2.5 text-[12.5px] text-danger">
            {getErrorMessage(archiveMutation.error)}
          </div>
        )}
      </ActionModal>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-7 left-1/2 z-[999] -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-navy px-5 py-2.5 text-[13px] font-medium text-white"
          style={{ animation: 'actionModalFadeUp 0.2s ease' }}
        >
          ✓ {toast}
        </div>
      )}
    </>
  )
}
