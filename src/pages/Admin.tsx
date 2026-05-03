import { useAuth } from '../lib/auth'

export function Admin() {
  const { user, profile, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">AleksaAI Admin</h1>
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
          <h2 className="mb-2 text-xl font-semibold">Willkommen, Aleksa</h2>
          <p className="text-sm text-slate-600">
            Role: <strong>{profile?.role ?? 'undefined'}</strong>
            {!profile && (
              <span className="ml-2 text-xs text-amber-700">
                (Profile noch nicht angelegt — Step 2 (Schema-Migration) ausstehend)
              </span>
            )}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Customer-Liste, Pricing-Plans, Calls-Log kommen in den nächsten Steps.
          </p>
        </div>
      </main>
    </div>
  )
}
