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
import { AgencyIntegrations } from './pages/agency/AgencyIntegrations'
import { PlatformAdminAgencies } from './pages/PlatformAdminAgencies'
import { PlatformAdminAgencyDetail } from './pages/PlatformAdminAgencyDetail'
import { StripeConnectCallback } from './pages/StripeConnectCallback'

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

  // Phase-I rescue: if Supabase didn't honor the redirectTo from
  // admin-approve-as-agency (we've seen this when the invite flow falls
  // back to site_url and strips the query string), look at
  // user.user_metadata.access_request_id — that field is embedded in the
  // invite token's `data` payload, so it survives any redirect loss.
  // When it's there AND the user hasn't yet been upgraded to agency_owner,
  // route them into the agency wizard with the right request_id.
  const accessRequestId =
    (user.user_metadata as Record<string, unknown> | undefined)?.access_request_id
  if (
    accessRequestId &&
    typeof accessRequestId === 'string' &&
    profile?.role !== 'agency_owner' &&
    !profile?.agency_id
  ) {
    return <Navigate to={`/agency-onboarding?request_id=${accessRequestId}`} replace />
  }

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
      {/* Public + universal */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <Account />
          </RequireAuth>
        }
      />

      {/* ============ ADMIN (Aleksa-only) ============ */}
      <Route
        path="/admin"
        element={
          <RequireAuth requireRole="admin">
            <Admin />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/requests"
        element={
          <RequireAuth requireRole="admin">
            <Requests />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/agents"
        element={
          <RequireAuth requireRole="admin">
            <AgentsList />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/agents/:id"
        element={
          <RequireAuth requireRole="admin">
            <AgentDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/integrations"
        element={
          <RequireAuth requireRole="admin">
            <Integrations />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/pricing-plans"
        element={
          <RequireAuth requireRole="admin">
            <PricingPlans />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/customers/:id"
        element={
          <RequireAuth requireRole="admin">
            <CustomerDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/customers/:id/view"
        element={
          <RequireAuth requireRole="admin">
            <CustomerPreview />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/calls/:id"
        element={
          <RequireAuth requireRole="admin">
            <CallDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/platform-admin/agencies"
        element={
          <RequireAuth requireRole="admin">
            <PlatformAdminAgencies />
          </RequireAuth>
        }
      />
      <Route
        path="/platform-admin/agencies/:id"
        element={
          <RequireAuth requireRole="admin">
            <PlatformAdminAgencyDetail />
          </RequireAuth>
        }
      />

      {/* ============ AGENCY OWNER (Partner) ============ */}
      {/* /agency-onboarding intentionally only requires auth — the user's role
          may still be customer_owner before they finish the wizard, so we
          can't role-gate this one. */}
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
          <RequireAuth requireRole="agency_owner">
            <AgencyHome />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/customers"
        element={
          <RequireAuth requireRole="agency_owner">
            <AgencyCustomers />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/customers/new"
        element={
          <RequireAuth requireRole="agency_owner">
            <AgencyCustomerNew />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/customers/:id"
        element={
          <RequireAuth requireRole="agency_owner">
            <AgencyCustomerDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/agents"
        element={
          <RequireAuth requireRole="agency_owner">
            <AgencyAgents />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/integrations"
        element={
          <RequireAuth requireRole="agency_owner">
            <AgencyIntegrations />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/settings"
        element={
          <RequireAuth requireRole="agency_owner">
            <AgencySettings />
          </RequireAuth>
        }
      />
      <Route
        path="/agency/settings/stripe-callback"
        element={
          <RequireAuth requireRole="agency_owner">
            <StripeConnectCallback />
          </RequireAuth>
        }
      />

      {/* ============ CUSTOMER OWNER (End Customers) ============ */}
      {/* /onboarding intentionally not role-gated — auth.users may not yet
          have the customer_id linked in profiles. */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth requireRole="customer_owner">
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/agents/:id/*"
        element={
          <RequireAuth requireRole="customer_owner">
            <CustomerAgentDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard/calls/:id"
        element={
          <RequireAuth requireRole="customer_owner">
            <CallDetail />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
