import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/shared/rbac/ProtectedRoute'
import { useAuth } from '@/shared/rbac/auth-context'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/modules/auth/LoginPage'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { PropertyCreatePage } from '@/modules/properties/PropertyCreatePage'

/** Gate a subtree behind one or more roles; redirect elsewhere if unauthorized. */
function RequireRole({
  roles,
  children,
}: {
  roles: string[]
  children: ReactNode
}) {
  const { role } = useAuth()
  if (role && roles.includes(role)) {
    return <>{children}</>
  }
  return <Navigate to="/dashboard" replace />
}

/** Authenticated page shell: requires a session, then renders inside the AppShell. */
function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell title={title}>{children}</AppShell>
    </ProtectedRoute>
  )
}

/** Like Shell, but additionally restricted to admin / manager roles. */
function AdminShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <ProtectedRoute>
      <RequireRole roles={['admin', 'manager']}>
        <AppShell title={title}>{children}</AppShell>
      </RequireRole>
    </ProtectedRoute>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={
          <Shell title="Dashboard">
            <DashboardPage />
          </Shell>
        }
      />

      <Route
        path="/properties"
        element={<Shell title="Properties">{<div>Properties</div>}</Shell>}
      />
      <Route
        path="/properties/new"
        element={
          <Shell title="Add Property">
            <PropertyCreatePage />
          </Shell>
        }
      />
      <Route
        path="/properties/:id"
        element={
          <Shell title="Property Detail">{<div>Property Detail</div>}</Shell>
        }
      />

      <Route
        path="/admin/users"
        element={<AdminShell title="Users">{<div>Users</div>}</AdminShell>}
      />
      <Route
        path="/admin/brands"
        element={<AdminShell title="Brands">{<div>Brands</div>}</AdminShell>}
      />
      <Route
        path="/admin/owners"
        element={<AdminShell title="Owners">{<div>Owners</div>}</AdminShell>}
      />
      <Route
        path="/admin/regions"
        element={<AdminShell title="Regions">{<div>Regions</div>}</AdminShell>}
      />

      <Route
        path="/logs"
        element={<Shell title="Event Logs">{<div>Event Logs</div>}</Shell>}
      />
    </Routes>
  )
}
