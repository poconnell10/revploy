import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/shared/lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Resolve the role for a session via the get_user_role RPC, then clear the
    // loading flag. Kept out of the onAuthStateChange callback body (deferred
    // below) to avoid the Supabase client lock deadlock.
    const applyRole = async (current: Session | null) => {
      if (current?.user) {
        const { data, error } = await supabase.rpc('get_user_role', {
          user_id: current.user.id,
        })
        if (!active) return
        setRole(error ? null : ((data as string | null) ?? null))
      } else if (active) {
        setRole(null)
      }
      if (active) setIsLoading(false)
    }

    // onAuthStateChange fires INITIAL_SESSION on subscribe, so this handles both
    // the initial load and subsequent sign-in / sign-out transitions.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return
      setSession(newSession)
      setTimeout(() => {
        if (active) void applyRole(newSession)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    // The SIGNED_OUT event from onAuthStateChange clears session and role.
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      role,
      isLoading,
      signOut,
    }),
    [session, role, isLoading, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
