import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { Admin } from './pages/Admin'
import { Dashboard } from './pages/Dashboard'
import { Invite } from './pages/Invite'
import { Onboarding } from './pages/Onboarding'
import { PricingPlans } from './pages/PricingPlans'

function HomeRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-500">Lade…</div>
      </div>
    )
  }

  if (!user) return <Login />

  // Role-based redirect once profile is known. Until profile loads, send admin to /admin by default.
  if (profile?.role === 'customer_owner') {
    // If customer-owner is missing customer link OR payment method, route through onboarding
    if (!profile.customer_id) return <Navigate to="/onboarding" replace />
    return <Navigate to="/dashboard" replace />
  }
  return <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Admin />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/pricing-plans"
        element={
          <RequireAuth>
            <PricingPlans />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
