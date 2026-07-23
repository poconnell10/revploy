import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/shared/rbac/ProtectedRoute'
import { useAuth } from '@/shared/rbac/auth-context'
import { AppShell } from '@/layouts/AppShell'
import { LoginPage } from '@/modules/auth/LoginPage'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { PropertiesPage } from '@/modules/properties/PropertiesPage'
import { PropertyCreatePage } from '@/modules/properties/PropertyCreatePage'
import { PropertyDetailPage } from '@/modules/properties/detail/PropertyDetailPage'
import { BrandsPage } from '@/modules/admin/brands/BrandsPage'
import { OwnersPage } from '@/modules/admin/owners/OwnersPage'
import { RegionsPage } from '@/modules/admin/regions/RegionsPage'
import { EventLogsPage } from '@/modules/logs/EventLogsPage'

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
        element={
          <Shell title="Properties">
            <PropertiesPage />
          </Shell>
        }
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
          <Shell title="Property Detail">
            <PropertyDetailPage />
          </Shell>
        }
      />

      <Route
        path="/admin/users"
        element={<AdminShell title="Users">{<div>Users</div>}</AdminShell>}
      />
      <Route
        path="/admin/brands"
        element={
          <AdminShell title="Brands">
            <BrandsPage />
          </AdminShell>
        }
      />
      <Route
        path="/admin/owners"
        element={
          <AdminShell title="Owners">
            <OwnersPage />
          </AdminShell>
        }
      />
      <Route
        path="/admin/regions"
        element={
          <AdminShell title="Regions">
            <RegionsPage />
          </AdminShell>
        }
      />

      <Route
        path="/logs"
        element={
          <Shell title="Event Logs">
            <EventLogsPage />
          </Shell>
        }
      />
    </Routes>
  )
}
