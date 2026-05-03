import { useAuth } from '../lib/auth'

export function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={signOut} className="btn-ghost text-sm">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="card">
          <h2 className="mb-2 text-xl font-semibold">Customer Dashboard</h2>
          <p className="text-sm text-slate-500">
            Calls-Log, Rechnungen und Voice-Agent-Settings kommen in V1.
          </p>
        </div>
      </main>
    </div>
  )
}
