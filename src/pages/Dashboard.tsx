import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Customer, VoiceAgent, PricingPlan, Integration, CustomerPermissions } from '../types/db'
import { getCustomerBillingPortalUrl } from '../lib/api'
import {
  formatMoney,
  formatDuration,
  ceilMinutes,
  projectedCostCents,
  costPerMinuteLabel,
  periodLabel,
} from '../lib/billing'

type Sub = {
  id: string
  status: string
  stripe_subscription_id: string
  current_period_start: string | null
  current_period_end: string | null
}

type AgentRow = VoiceAgent & {
  integrations: Pick<Integration, 'name' | 'platform' | 'region'> | null
  pricing_plans: PricingPlan | null
  customer_subscriptions: Sub[]
}

type CallRow = {
  id: string
  voice_agent_id: string
  duration_secs: number
  started_at: string
  termination_reason: string | null
}

type Props = {
  // Optional override for Admin "View as Customer" preview.
  // When set, the Dashboard renders the given customer's data
  // (Admin's RLS lets them see all customers; CustomerOwners use null = self).
  customerIdOverride?: string
  isAdminPreview?: boolean
}

export function Dashboard({ customerIdOverride, isAdminPreview }: Props = {}) {
  const { user, profile, signOut } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [callsByAgent, setCallsByAgent] = useState<Record<string, CallRow[]>>({})
  const [perms, setPerms] = useState<CustomerPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [openAgentId, setOpenAgentId] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const targetCustomerId = customerIdOverride ?? profile?.customer_id ?? null

  useEffect(() => {
    if (!targetCustomerId) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const { data: c } = await supabase.from('customers').select('*').eq('id', targetCustomerId).maybeSingle()
      setCustomer(c as Customer | null)

      const { data: a } = await supabase
        .from('voice_agents')
        .select(`
          *,
          integrations(name, platform, region),
          pricing_plans(*),
          customer_subscriptions(id, status, stripe_subscription_id, current_period_start, current_period_end)
        `)
        .eq('customer_id', targetCustomerId)
        .order('created_at', { ascending: false })
      setAgents((a ?? []) as AgentRow[])

      // Permissions (so we know whether to show 'Konfigurieren →' buttons)
      const { data: p } = await supabase
        .from('customer_permissions')
        .select('*')
        .eq('customer_id', targetCustomerId)
        .maybeSingle()
      setPerms(p as CustomerPermissions | null)

      // Fetch all calls for this customer (RLS lets owner see only own)
      const { data: cs } = await supabase
        .from('calls')
        .select('id, voice_agent_id, duration_secs, started_at, termination_reason')
        .eq('customer_id', targetCustomerId)
        .order('started_at', { ascending: false })
      const grouped: Record<string, CallRow[]> = {}
      for (const cl of (cs ?? []) as CallRow[]) {
        if (!grouped[cl.voice_agent_id]) grouped[cl.voice_agent_id] = []
        grouped[cl.voice_agent_id].push(cl)
      }
      setCallsByAgent(grouped)

      setLoading(false)
    })()
  }, [targetCustomerId])

  const canConfigureAgent = (perms?.can_edit_agent_config ?? false) || (perms?.can_edit_kb ?? false)
  const canViewCalls = perms?.can_view_calls ?? false
  // Admin viewing as customer sees calls regardless of customer's permission
  const showCallsLog = isAdminPreview || canViewCalls

  const handleOpenBillingPortal = async () => {
    if (isAdminPreview) {
      alert('Admin-Preview-Modus — Stripe Customer Portal kann der Customer selbst öffnen.')
      return
    }
    setPortalLoading(true)
    try {
      const url = await getCustomerBillingPortalUrl()
      window.location.href = url
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-slate-500">Lade Dashboard…</div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <h2 className="text-lg font-semibold">Kein Customer verlinkt</h2>
          <p className="mt-1 text-sm text-slate-500">
            Dein Profil hat keine Customer-Zuordnung. Bitte den Admin kontaktieren.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold">
              {isAdminPreview ? `Preview: ${customer.name}` : customer.name}
            </h1>
            {isAdminPreview && (
              <p className="text-xs text-amber-700">👁 Admin-View — du siehst was der Customer sieht</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isAdminPreview && <span className="text-sm text-slate-600">{user?.email}</span>}
            {isAdminPreview ? (
              <button
                onClick={() => (window.location.href = `/admin/customers/${customer.id}`)}
                className="btn-ghost text-sm"
              >
                ← Zurück zum Admin
              </button>
            ) : (
              <button onClick={signOut} className="btn-ghost text-sm">
                Abmelden
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {agents.length === 0 ? (
          <div className="card text-center">
            <h2 className="text-lg font-semibold">Noch keine Agents zugewiesen</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sobald dir ein Voice-Agent zugewiesen ist, siehst du hier alle Stats + Rechnungen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {agents.map((agent) => {
              const sub = agent.customer_subscriptions?.[0] ?? null
              const plan = agent.pricing_plans
              const calls = callsByAgent[agent.id] ?? []

              // Filter calls to current period if subscription exists
              const periodCalls = sub?.current_period_start
                ? calls.filter((c) => new Date(c.started_at) >= new Date(sub.current_period_start!))
                : calls

              const totalSecs = periodCalls.reduce((s, c) => s + c.duration_secs, 0)
              const minutes = ceilMinutes(totalSecs)
              const projected = projectedCostCents(plan, totalSecs)
              const isOpen = openAgentId === agent.id

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                >
                  <div
                    className="flex cursor-pointer items-start justify-between"
                    onClick={() => setOpenAgentId(isOpen ? null : agent.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{agent.display_name ?? agent.platform_agent_id}</h2>
                        {agent.integrations && (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {agent.integrations.platform}
                            {agent.integrations.region ? ` · ${agent.integrations.region.toUpperCase()}` : ''}
                          </span>
                        )}
                      </div>
                      {agent.platform_phone_number_id && (
                        <p className="mt-1 font-mono text-xs text-slate-500">📞 {agent.platform_phone_number_id}</p>
                      )}
                      {plan && (
                        <p className="mt-1 text-xs text-slate-500">
                          {plan.name} · <span className="font-medium text-slate-700">{costPerMinuteLabel(plan)}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {sub ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Abo aktiv
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Kein Abo
                        </span>
                      )}
                      <button className="btn-ghost mt-1 text-xs">
                        {isOpen ? '▾ schließen' : '▸ Details'}
                      </button>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Anrufe" value={periodCalls.length.toString()} />
                    <Stat label="Gesamt-Nutzung" value={formatDuration(totalSecs)} />
                    <Stat
                      label="Aufgerundet"
                      value={minutes > 0 ? `${minutes} Min` : '—'}
                    />
                    <Stat
                      label="Aktuelle Kosten"
                      value={plan ? formatMoney(projected, plan.currency) : '—'}
                      emphasis
                    />
                  </div>

                  {sub && (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <span className="text-slate-500">
                        Abrechnungszeitraum: <strong>{periodLabel(sub.current_period_start, sub.current_period_end)}</strong>
                      </span>
                    </div>
                  )}

                  {canConfigureAgent && !isAdminPreview && (
                    <div className="mt-3 flex justify-end">
                      <Link to={`/dashboard/agents/${agent.id}`} className="btn-primary text-sm">
                        Agent konfigurieren →
                      </Link>
                    </div>
                  )}

                  {/* Expanded: Calls log */}
                  {isOpen && showCallsLog && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 border-t border-slate-200 pt-4"
                    >
                      <h3 className="mb-2 text-sm font-semibold">Anrufe (Zeitraum)</h3>
                      {periodCalls.length === 0 ? (
                        <p className="text-xs text-slate-500">Noch keine Anrufe in dieser Periode.</p>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Datum</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Dauer</th>
                                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Ende</th>
                                <th className="px-3 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {periodCalls.map((c) => (
                                <tr
                                  key={c.id}
                                  className="cursor-pointer hover:bg-slate-50"
                                  onClick={() => {
                                    const path = isAdminPreview ? `/admin/calls/${c.id}` : `/dashboard/calls/${c.id}`
                                    window.location.href = path
                                  }}
                                >
                                  <td className="px-3 py-2 text-xs text-slate-700">
                                    {new Date(c.started_at).toLocaleString('de-DE', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-700">{formatDuration(c.duration_secs)}</td>
                                  <td className="px-3 py-2 text-xs text-slate-500">
                                    {c.termination_reason ?? '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="text-xs text-brand-700">Details →</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {isOpen && !showCallsLog && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500"
                    >
                      Calls-Einsicht ist für deinen Account nicht freigeschaltet.
                    </motion.div>
                  )}
                </motion.div>
              )
            })}

            {/* Billing Portal button */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Abrechnungen & Zahlungsmethode</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Sieh deine Rechnungen, ändere deine Karte oder lade Belege herunter.
                  </p>
                </div>
                <button
                  onClick={handleOpenBillingPortal}
                  disabled={portalLoading || isAdminPreview}
                  className="btn-primary"
                  title={isAdminPreview ? 'Im Admin-Preview deaktiviert' : ''}
                >
                  {portalLoading ? 'Lade…' : 'Abo verwalten →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${emphasis ? 'bg-brand-50' : 'bg-slate-50'}`}>
      <p className={`text-xs ${emphasis ? 'text-brand-700' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${emphasis ? 'text-brand-900' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
