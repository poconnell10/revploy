import { useEffect, useRef, useState } from 'react'

import { cn } from '@/shared/lib/utils'

export interface DropdownOption {
  value: string
  label: string
  /** Leading colored dot (lifecycle/region/risk options). */
  dot?: string
  /** Second-line sub label (person options). */
  sub?: string
  /** Avatar initials (person options). */
  initials?: string
  avatarBg?: string
  avatarColor?: string
}

export interface CustomDropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  width?: string
}

/** Rich custom dropdown supporting dot, person, and plain option rows. */
export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  width,
}: CustomDropdownProps) {
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

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative" style={{ width }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-[9px] text-left text-[13px] text-gray-700 transition-colors',
          disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-gray-200',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.dot && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: selected.dot }}
            />
          )}
          <span className={cn('truncate', !selected && 'text-gray-400')}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span className="shrink-0 text-[10px] text-gray-400">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-full overflow-hidden rounded-lg border border-gray-100 bg-white"
          style={{
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            animation: 'customDropdownIn 0.12s ease',
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value
            const isPerson = !!opt.initials
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 text-left transition-colors',
                  isPerson ? 'py-2' : 'h-9',
                  active ? 'bg-gold-light' : 'hover:bg-[#f8fafc]',
                )}
              >
                {isPerson ? (
                  <>
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{
                        background: opt.avatarBg,
                        color: opt.avatarColor,
                      }}
                    >
                      {opt.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-navy">
                        {opt.label}
                      </span>
                      {opt.sub && (
                        <span className="block truncate text-[12px] text-gray-400">
                          {opt.sub}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    {opt.dot && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: opt.dot }}
                      />
                    )}
                    <span
                      className={cn(
                        'truncate text-[13px]',
                        active ? 'font-semibold text-warning' : 'text-gray-700',
                      )}
                    >
                      {opt.label}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
