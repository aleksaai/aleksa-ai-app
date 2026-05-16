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
import { Account } from './pages/Account'
import { AgencyHome } from './pages/agency/AgencyHome'
import { AgencyCustomers } from './pages/agency/AgencyCustomers'
import { AgencyAgents } from './pages/agency/AgencyAgents'
import { AgencySettings } from './pages/agency/AgencySettings'
import { AgencyOnboarding } from './pages/AgencyOnboarding'
import { AgencyCustomerNew } from './pages/agency/AgencyCustomerNew'
import { AgencyCustomerDetail } from './pages/agency/AgencyCustomerDetail'

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

  // Role-based redirect once profile is known.
  if (profile?.role === 'agency_owner') {
    // Agency owner without agency_id yet → onboarding flow (Phase I)
    if (!profile.agency_id) return <Navigate to="/agency-onboarding" replace />
    return <Navigate to="/agency" replace />
  }
  if (profile?.role === 'customer_owner') {
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
        path="/account"
        element={
          <RequireAuth>
            <Account />
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
      {/* ============ AGENCY OWNER (PARTNER) ROUTES ============ */}
      <Route
        path="/agency-onboarding"
        element={
          <RequireAuth>
            <AgencyOnboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/agency"
        element={
          <RequireAuth>
            <AgencyHome />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/customers"
        element={
          <RequireAuth>
            <AgencyCustomers />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/customers/new"
        element={
          <RequireAuth>
            <AgencyCustomerNew />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/customers/:id"
        element={
          <RequireAuth>
            <AgencyCustomerDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/agents"
        element={
          <RequireAuth>
            <AgencyAgents />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/settings"
        element={
          <RequireAuth>
            <AgencySettings />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
