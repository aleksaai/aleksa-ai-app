import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { VoiceAgent, Integration, Customer, PricingPlan } from '../types/db'

type Row = VoiceAgent & {
  customers: Pick<Customer, 'id' | 'name'> | null
  integrations: Pick<Integration, 'name' | 'platform' | 'region'> | null
  pricing_plans: Pick<PricingPlan, 'name' | 'type'> | null
  customer_subscriptions: { status: string }[]
}

export function AgentsList() {
  const { user, signOut } = useAuth()
  const [agents, setAgents] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('voice_agents')
        .select(`
          *,
          customers(id, name),
          integrations(name, platform, region),
          pricing_plans(name, type),
          customer_subscriptions(status)
        `)
        .order('created_at', { ascending: false })
      setAgents((data ?? []) as Row[])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-lg font-semibold">AleksaAI Admin</Link>
            <nav className="flex gap-1">
              <Link to="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Kunden</Link>
              <Link to="/admin/agents" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900">Agenten</Link>
              <Link to="/admin/integrations" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Integrationen</Link>
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
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Agenten</h2>
          <p className="mt-1 text-sm text-slate-500">
            Alle Voice-Agents über alle Customers. Klick einen an, um Prompt + Voice zu editieren (Live-Sync zu ElevenLabs).
          </p>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade…</div>
        ) : agents.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
            <h3 className="text-base font-medium">Noch keine Agents</h3>
            <p className="mt-1 text-sm text-slate-500">
              Geh zu einem Kunden und füge dort einen Voice-Agent hinzu.
            </p>
          </motion.div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Integration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Pricing</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {agents.map((a) => {
                  const sub = a.customer_subscriptions?.[0]
                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => (window.location.href = `/admin/agents/${a.id}`)}
                    >
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-slate-900">{a.display_name ?? a.platform_agent_id}</div>
                        <div className="font-mono text-xs text-slate-500">{a.platform_agent_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{a.customers?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {a.integrations ? (
                          <div>
                            <div className="text-slate-700">{a.integrations.name}</div>
                            <div className="text-xs text-slate-500">
                              {a.integrations.platform}
                              {a.integrations.region ? ` · ${a.integrations.region.toUpperCase()}` : ''}
                            </div>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {a.pricing_plans ? (
                          <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            {a.pricing_plans.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">— kein Plan —</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {sub?.status === 'active' ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">aktiv</span>
                        ) : sub ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{sub.status}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
