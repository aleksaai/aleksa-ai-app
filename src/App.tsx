import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { Admin } from './pages/Admin'
import { Dashboard } from './pages/Dashboard'

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
  if (profile?.role === 'customer_owner') return <Navigate to="/dashboard" replace />
  return <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Admin />
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
