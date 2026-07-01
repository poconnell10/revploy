import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/shared/rbac/auth-context'
import { cn } from '@/shared/lib/utils'

interface NavItem {
  label: string
  /** Where the link navigates. */
  to: string
  /** Path prefix used to compute the active state. */
  match: string
  icon: ReactNode
}

/** Build a 16px inline SVG icon from one or more path definitions. */
function navIcon(paths: string[]): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}

const MAIN_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    match: '/dashboard',
    icon: navIcon(['M2 2h5v5H2zm7 0h5v5H9zM2 9h5v5H2zm7 0h5v5H9z']),
  },
  {
    label: 'Properties',
    to: '/properties',
    match: '/properties',
    icon: navIcon([
      'M4 14V5a1 1 0 011-1h6a1 1 0 011 1v9',
      'M1 14h14',
      'M6 8h1m3 0h1M6 11h1m3 0h1',
    ]),
  },
  {
    label: 'Event Logs',
    to: '/logs',
    match: '/logs',
    icon: navIcon(['M3 4h10', 'M3 8h10', 'M3 12h7']),
  },
]

const ADMIN_NAV: NavItem[] = [
  {
    label: 'Users',
    to: '/admin/users',
    match: '/admin/users',
    icon: navIcon([
      'M6 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
      'M2 14c0-2.2 1.7-3.5 4-3.5s4 1.3 4 3.5',
      'M12.5 5v5',
      'M10 7.5h5',
    ]),
  },
  {
    label: 'Brands',
    to: '/admin/brands',
    match: '/admin/brands',
    icon: navIcon([
      'M2 2h5.17a1 1 0 01.71.29l6.02 6.02a1 1 0 010 1.42l-4.48 4.48a1 1 0 01-1.42 0L1.71 8.12A1 1 0 011.5 7.4V3a1 1 0 011-1z',
      'M5 5.5a.5.5 0 110-1 .5.5 0 010 1z',
    ]),
  },
  {
    label: 'Owners',
    to: '/admin/owners',
    match: '/admin/owners',
    icon: navIcon([
      'M3 14V3a1 1 0 011-1h6a1 1 0 011 1v11',
      'M11 6h2a1 1 0 011 1v7',
      'M1 14h14',
      'M5 5h1M8 5h1M5 8h1M8 8h1M5 11h1M8 11h1',
    ]),
  },
  {
    label: 'Regions',
    to: '/admin/regions',
    match: '/admin/regions',
    icon: navIcon([
      'M1 4l4.5-2 5 2L15 2v10l-4.5 2-5-2L1 14z',
      'M5.5 2v10',
      'M10.5 4v10',
    ]),
  },
]

/** Turn an email into a best-effort display name, e.g. alex.kim@x → "Alex Kim". */
function deriveName(email: string): string {
  const local = email.split('@')[0] ?? ''
  const name = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return name || 'User'
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AppShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const { user, role, signOut } = useAuth()
  const location = useLocation()

  const canSeeAdmin = role === 'admin' || role === 'manager'

  const displayName = deriveName(user?.email ?? '')
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : 'No role'

  const renderNavLink = (item: NavItem) => {
    const isActive =
      location.pathname === item.match ||
      location.pathname.startsWith(`${item.match}/`)
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-[13px] tracking-tight transition-colors',
          isActive
            ? 'border-gold bg-[rgba(245,166,35,0.13)] font-semibold text-white'
            : 'border-transparent font-normal text-[rgba(255,255,255,0.52)] hover:bg-[rgba(255,255,255,0.06)]',
        )}
      >
        <span className="flex shrink-0 items-center">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-700">
      {/* SIDEBAR */}
      <aside className="flex w-[220px] shrink-0 flex-col overflow-hidden bg-navy">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[rgba(255,255,255,0.07)] p-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold">
            <span className="text-sm font-extrabold leading-none text-navy">
              R
            </span>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-white">
            Revploy
          </span>
          <span className="ml-auto rounded bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[rgba(255,255,255,0.4)]">
            FPG
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2 py-2.5">
          {MAIN_NAV.map(renderNavLink)}

          {canSeeAdmin && (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.22)]">
                Admin
              </div>
              {ADMIN_NAV.map(renderNavLink)}
            </>
          )}
        </nav>

        {/* User section */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-[rgba(255,255,255,0.07)] p-3.5">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[rgba(245,166,35,0.4)] bg-navy-light">
            <span className="text-[11px] font-bold text-gold">
              {initials(displayName)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium text-white">
              {displayName}
            </div>
            <div className="truncate text-[11px] text-[rgba(245,166,35,0.7)]">
              {roleLabel}
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="z-10 flex h-[52px] shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-6">
          <h1 className="text-[15px] font-semibold tracking-tight text-navy">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => void signOut()}
            className="ml-auto rounded-md border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Sign out
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
