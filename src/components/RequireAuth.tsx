import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { ReactNode } from 'react'
import type { UserRole } from '../types/db'

type Props = {
  children: ReactNode
  /** Restrict access to a single role. Wrong-role users get redirected to
   *  their own role's home (not an error screen) so they never see UI
   *  meant for another role. */
  requireRole?: UserRole
}

export function RequireAuth({ children, requireRole }: Props) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-500">Lade…</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // Wait for profile to load before role-checking — otherwise a freshly
  // logged-in user can briefly trip the wrong-role redirect.
  if (requireRole && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-500">Lade Profil…</div>
      </div>
    )
  }

  if (requireRole && profile && profile.role !== requireRole) {
    // Redirect to the caller's own role home — they shouldn't see UI for
    // another role, and certainly shouldn't see nav items pointing at it.
    if (profile.role === 'admin') return <Navigate to="/admin" replace />
    if (profile.role === 'agency_owner') {
      return <Navigate to={profile.agency_id ? '/agency' : '/agency-onboarding'} replace />
    }
    // customer_owner
    return <Navigate to={profile.customer_id ? '/dashboard' : '/onboarding'} replace />
  }

  return <>{children}</>
}
