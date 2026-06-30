import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from './auth-context'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-gold/30 border-t-gold"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
