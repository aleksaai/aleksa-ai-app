import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { Admin } from './pages/Admin'
import { Dashboard } from './pages/Dashboard'
import { Invite } from './pages/Invite'
import { Onboarding } from './pages/Onboarding'
import { PricingPlans } from './pages/PricingPlans'
import { CustomerDetail } from './pages/CustomerDetail'
import { Integrations } from './pages/Integrations'
import { CustomerPreview } from './pages/CustomerPreview'
import { AgentsList } from './pages/AgentsList'
import { AgentDetail } from './pages/AgentDetail'
import { CustomerAgentDetail } from './pages/CustomerAgentDetail'
import { CallDetail } from './pages/CallDetail'
import { ResetPassword } from './pages/ResetPassword'
import { Signup } from './pages/Signup'
import { Requests } from './pages/Requests'

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
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/admin/requests"
        element={
          <RequireAuth>
            <Requests />
          </RequireAuth>
        }
      />
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
        path="/admin/agents"
        element={
          <RequireAuth>
            <AgentsList />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/agents/:id"
        element={
          <RequireAuth>
            <AgentDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/integrations"
        element={
          <RequireAuth>
            <Integrations />
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
        path="/admin/customers/:id"
        element={
          <RequireAuth>
            <CustomerDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/customers/:id/view"
        element={
          <RequireAuth>
            <CustomerPreview />
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
      <Route
        path="/dashboard/agents/:id/*"
        element={
          <RequireAuth>
            <CustomerAgentDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/calls/:id"
        element={
          <RequireAuth>
            <CallDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/calls/:id"
        element={
          <RequireAuth>
            <CallDetail />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
