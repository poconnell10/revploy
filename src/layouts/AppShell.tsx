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
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', match: '/dashboard' },
  { label: 'Properties', to: '/properties', match: '/properties' },
  { label: 'Admin', to: '/admin/users', match: '/admin', adminOnly: true },
  { label: 'Logs', to: '/logs', match: '/logs' },
]

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
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || canSeeAdmin)

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-60 flex-col bg-navy">
        <div className="px-6 py-5 font-sans text-xl font-bold text-gold">
          Revploy
        </div>
        <nav className="flex-1 py-2">
          {items.map((item) => {
            const isActive =
              location.pathname === item.match ||
              location.pathname.startsWith(`${item.match}/`)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'block border-l-4 px-5 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-gold text-gold'
                    : 'border-transparent text-gray-400 hover:bg-navy-light',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  )
}
