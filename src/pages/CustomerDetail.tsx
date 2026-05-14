import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Customer, VoiceAgent, PricingPlan, Integration } from '../types/db'
import { AddVoiceAgentDialog } from '../components/AddVoiceAgentDialog'
import { AssignPricingDialog } from '../components/AssignPricingDialog'

type AgentRow = VoiceAgent & {
  pricing_plans: PricingPlan | null
  integrations: Pick<Integration, 'name' | 'platform' | 'region'> | null
  customer_subscriptions: { id: string; status: string; stripe_subscription_id: string }[]
}

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, signOut } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addAgentOpen, setAddAgentOpen] = useState(false)
  const [assignAgent, setAssignAgent] = useState<AgentRow | null>(null)

  const load = async () => {
    if (!id) return
    setLoading(true)
    const { data: c } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
    setCustomer(c as Customer | null)
    const { data: a } = await supabase
      .from('voice_agents')
      .select('*, pricing_plans(*), integrations(name, platform, region), customer_subscriptions(id, status, stripe_subscription_id)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
    setAgents((a ?? []) as AgentRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-lg font-semibold">AleksaAI Admin</Link>
            <nav className="flex gap-1">
              <Link to="/admin" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900">Kunden</Link>
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
        <div className="mb-4">
          <Link to="/admin" className="text-sm text-slate-500 hover:text-slate-900">← Zurück zu Kunden</Link>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade…</div>
        ) : !customer ? (
          <div className="card text-center text-sm text-red-700">Customer nicht gefunden.</div>
        ) : (
          <>
            <section className="card mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">{customer.name}</h1>
                  <p className="mt-1 text-sm text-slate-500">{customer.contact_email}</p>
                </div>
                <div>
                  {customer.has_payment_method ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      ✓ Zahlungsmethode hinterlegt
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      Pending Onboarding
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <p className="text-slate-500">Stripe Customer-ID</p>
                  <code className="text-slate-900">{customer.stripe_customer_id}</code>
                </div>
                <div>
                  <p className="text-slate-500">Erstellt</p>
                  <p className="text-slate-900">{new Date(customer.created_at).toLocaleString('de-DE')}</p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Voice-Agents</h2>
                <button onClick={() => setAddAgentOpen(true)} className="btn-primary text-sm">
                  + Voice-Agent
                </button>
              </div>

              {agents.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card text-center">
                  <p className="text-sm text-slate-500">
                    Noch keine Agents. Klick oben rechts auf <strong>+ Voice-Agent</strong>.
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {agents.map((a) => {
                    const activeSub = a.customer_subscriptions?.find((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due')
                    return (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-base font-semibold">
                              {a.display_name ?? a.platform_agent_id}
                            </h3>
                            {a.integrations && (
                              <p className="mt-1 text-xs text-slate-500">
                                via{' '}
                                <span className="font-medium text-slate-700">
                                  {a.integrations.name}
                                </span>
                                {' '}({a.integrations.platform}
                                {a.integrations.region ? `, ${a.integrations.region.toUpperCase()}` : ''})
                              </p>
                            )}
                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {a.platform_agent_id}
                            </p>
                            {a.platform_phone_number_id && (
                              <p className="font-mono text-xs text-slate-500">📞 {a.platform_phone_number_id}</p>
                            )}
                          </div>
                          <div className="text-right">
                            {a.pricing_plans ? (
                              <div>
                                <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                                  {a.pricing_plans.name}
                                </span>
                                {activeSub && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Status: <strong>{activeSub.status}</strong>
                                  </p>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => setAssignAgent(a)}
                                disabled={!customer.has_payment_method}
                                className="btn-ghost text-xs"
                                title={!customer.has_payment_method ? 'Customer hat noch keine Zahlungsmethode hinterlegt' : ''}
                              >
                                + Pricing zuweisen
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {customer && (
        <>
          <AddVoiceAgentDialog
            open={addAgentOpen}
            customerId={customer.id}
            onClose={() => setAddAgentOpen(false)}
            onCreated={load}
          />
          <AssignPricingDialog
            open={!!assignAgent}
            voiceAgentId={assignAgent?.id ?? ''}
            voiceAgentName={assignAgent?.display_name ?? assignAgent?.platform_agent_id ?? ''}
            onClose={() => setAssignAgent(null)}
            onAssigned={load}
          />
        </>
      )}
    </div>
  )
}
