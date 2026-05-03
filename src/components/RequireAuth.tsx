import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  requireRole?: 'admin' | 'customer_owner'
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

  if (requireRole && profile?.role !== requireRole) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="card max-w-md text-center">
          <h2 className="mb-2 text-lg font-semibold">Kein Zugriff</h2>
          <p className="text-sm text-slate-600">
            Diese Seite ist nur für {requireRole === 'admin' ? 'Administratoren' : 'Customer-Owner'}.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
