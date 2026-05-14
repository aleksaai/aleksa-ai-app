import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Integration } from '../types/db'
import { NewIntegrationDialog } from '../components/NewIntegrationDialog'

const PLATFORM_BADGE: Record<string, string> = {
  elevenlabs: 'bg-purple-100 text-purple-800',
  retellai: 'bg-blue-100 text-blue-800',
  vapi: 'bg-green-100 text-green-800',
  openai: 'bg-slate-100 text-slate-800',
}

export function Integrations() {
  const { user, signOut } = useAuth()
  const [list, setList] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('integrations')
      .select('id, name, platform, region, active, created_at, updated_at')
      .order('created_at', { ascending: false })
    setList((data ?? []) as Integration[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-lg font-semibold">AleksaAI Admin</Link>
            <nav className="flex gap-1">
              <Link to="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Kunden</Link>
              <Link to="/admin/agents" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Agenten</Link>
              <Link to="/admin/integrations" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900">Integrationen</Link>
              <Link to="/admin/pricing-plans" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Pricing-Pakete</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={signOut} className="btn-ghost text-sm">Abmelden</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Integrationen</h2>
            <p className="mt-1 text-sm text-slate-500">
              {list.length === 0
                ? 'Verbinde einen Voice-AI- oder LLM-Provider, um Agenten anzulegen.'
                : `${list.length} verbundene ${list.length === 1 ? 'Integration' : 'Integrationen'}.`}
            </p>
          </div>
          <button onClick={() => setDialogOpen(true)} className="btn-primary">
            + Neue Integration
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade…</div>
        ) : list.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
            <h3 className="text-base font-medium">Noch keine Integrationen</h3>
            <p className="mt-1 text-sm text-slate-500">
              ElevenLabs, RetellAI, Vapi oder OpenAI verbinden.
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((i) => (
              <motion.div key={i.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_BADGE[i.platform] ?? 'bg-slate-100 text-slate-700'}`}>
                    {i.platform}
                  </span>
                  {i.platform === 'elevenlabs' && i.region && (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {i.region.toUpperCase()}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold">{i.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Verbunden am {new Date(i.created_at).toLocaleDateString('de-DE')}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <NewIntegrationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </div>
  )
}
