import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  /** Role name from the get_user_role RPC, or null if unknown/unassigned. */
  role: string | null
  isLoading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

/** Access the authenticated user, session and role. Must be used inside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
