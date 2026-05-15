import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type {
  Customer,
  VoiceAgent,
  PricingPlan,
  Integration,
  CustomerPermissions,
} from '../types/db'
import { getCustomerBillingPortalUrl } from '../lib/api'
import {
  formatMoney,
  formatDuration,
  ceilMinutes,
  projectedCostCents,
  costPerMinuteLabel,
  periodLabel,
} from '../lib/billing'
import { CustomerShell } from '../components/CustomerShell'

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
  customerIdOverride?: string
  isAdminPreview?: boolean
}

export function Dashboard({ customerIdOverride, isAdminPreview }: Props = {}) {
  const { profile } = useAuth()
  const navigate = useNavigate()
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
      const { data: c } = await supabase
        .from('customers')
        .select('*')
        .eq('id', targetCustomerId)
        .maybeSingle()
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

      const { data: p } = await supabase
        .from('customer_permissions')
        .select('*')
        .eq('customer_id', targetCustomerId)
        .maybeSingle()
      setPerms(p as CustomerPermissions | null)

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
      <CustomerShell customerName={customer?.name}>
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade Dashboard…</div>
      </CustomerShell>
    )
  }

  if (!customer) {
    return (
      <CustomerShell>
        <div className="glass-card-lg mx-auto max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Kein Konto verknüpft</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Dein Profil hat keine Kunden-Zuordnung. Bitte kontaktiere den Admin.
          </p>
        </div>
      </CustomerShell>
    )
  }

  return (
    <CustomerShell
      customerName={customer.name}
      adminPreview={isAdminPreview}
      onExitPreview={() => (window.location.href = `/admin/customers/${customer.id}`)}
      pageEyebrow="Mein Dashboard"
      pageTitle={
        <>
          Willkommen, <span className="heading-accent">{customer.name.split(' ')[0]}</span>
        </>
      }
    >
      {agents.length === 0 ? (
        <div className="glass-card-lg p-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Agenten</span>
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Sobald dir ein Voice-Agent zugewiesen ist, siehst du hier alle Statistiken und Rechnungen.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent, i) => {
            const sub = agent.customer_subscriptions?.[0] ?? null
            const plan = agent.pricing_plans
            const calls = callsByAgent[agent.id] ?? []
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                className="overflow-hidden rounded-2xl glass p-5"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => setOpenAgentId(isOpen ? null : agent.id)}
                >
                  <div className="flex items-center gap-3">
                    <AgentBadge />
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-ink">
                        {agent.display_name ?? 'Voice-Agent'}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        {agent.integrations && (
                          <span className="pill-neutral">
                            {agent.integrations.platform}
                            {agent.integrations.region ? ` · ${agent.integrations.region.toUpperCase()}` : ''}
                          </span>
                        )}
                        {plan && (
                          <span className="text-ink-muted">
                            {plan.name} ·{' '}
                            <span className="font-medium text-ink-soft">{costPerMinuteLabel(plan)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {sub ? (
                      <span className="pill-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Abo aktiv
                      </span>
                    ) : (
                      <span className="pill-warn">Kein Abo</span>
                    )}
                    <span className="text-xs text-ink-muted">
                      {isOpen ? 'Schließen ↑' : 'Details ↓'}
                    </span>
                  </div>
                </button>

                {/* Stats */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Anrufe" value={periodCalls.length.toString()} />
                  <Stat label="Nutzung" value={formatDuration(totalSecs)} />
                  <Stat label="Aufgerundet" value={minutes > 0 ? `${minutes} Min` : '—'} />
                  <Stat
                    label="Aktuelle Kosten"
                    value={plan ? formatMoney(projected, plan.currency) : '—'}
                    emphasis
                  />
                </div>

                {sub && (
                  <div className="mt-4 rounded-xl bg-white/40 px-4 py-2.5 text-xs text-ink-muted">
                    Abrechnungszeitraum:{' '}
                    <strong className="text-ink-soft">
                      {periodLabel(sub.current_period_start, sub.current_period_end)}
                    </strong>
                  </div>
                )}

                {canConfigureAgent && !isAdminPreview && (
                  <div className="mt-4 flex justify-end">
                    <Link to={`/dashboard/agents/${agent.id}`} className="btn-primary text-sm">
                      Agent konfigurieren →
                    </Link>
                  </div>
                )}

                {/* Calls log (expanded) */}
                <AnimatePresence initial={false}>
                  {isOpen && showCallsLog && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 overflow-hidden border-t border-white/40 pt-5"
                    >
                      <h3 className="label-soft mb-3">Anrufe (aktueller Zeitraum)</h3>
                      {periodCalls.length === 0 ? (
                        <p className="text-sm text-ink-muted">Noch keine Anrufe in dieser Periode.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {periodCalls.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                const path = isAdminPreview
                                  ? `/admin/calls/${c.id}`
                                  : `/dashboard/calls/${c.id}`
                                navigate(path)
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/40 px-4 py-2.5 text-left transition-colors hover:bg-white/70"
                            >
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-ink-soft">
                                  {new Date(c.started_at).toLocaleString('de-DE', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <span className="font-medium text-ink">
                                  {formatDuration(c.duration_secs)}
                                </span>
                                {c.termination_reason && (
                                  <span className="pill-neutral text-[10px]">
                                    {c.termination_reason}
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-xs font-medium"
                                style={{ color: 'var(--accent-700)' }}
                              >
                                Details →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {isOpen && !showCallsLog && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-5 overflow-hidden border-t border-white/40 pt-5 text-sm text-ink-muted"
                    >
                      Die Einsicht in einzelne Anrufe ist für dein Konto nicht freigeschaltet.
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}

          {/* Billing portal */}
          <div className="glass-card-lg p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow mb-1">Rechnungen & Zahlung</p>
                <h3 className="text-lg font-semibold tracking-tight">
                  Verwalte deine <span className="heading-accent">Abrechnungen</span>
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Sieh deine Rechnungen, lade Belege herunter oder ändere deine Zahlungsmethode.
                </p>
              </div>
              <button
                onClick={handleOpenBillingPortal}
                disabled={portalLoading || isAdminPreview}
                className="btn-primary shrink-0"
                title={isAdminPreview ? 'Im Admin-Preview deaktiviert' : ''}
              >
                {portalLoading ? 'Lade…' : 'Portal öffnen →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerShell>
  )
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: emphasis
          ? 'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.18) 0%, rgba(var(--accent-400-rgb), 0.08) 100%)'
          : 'rgba(255, 255, 255, 0.5)',
        border: emphasis
          ? '1px solid rgba(var(--accent-400-rgb), 0.25)'
          : '1px solid rgba(255, 255, 255, 0.6)',
      }}
    >
      <p
        className="label-soft"
        style={emphasis ? { color: 'var(--accent-700)', opacity: 0.85 } : undefined}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-semibold tracking-tight"
        style={emphasis ? { color: 'var(--accent-800)' } : { color: '#15141c' }}
      >
        {value}
      </p>
    </div>
  )
}

function AgentBadge() {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
      style={{
        background:
          'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 4px 14px -4px rgba(var(--accent-shadow-rgb),0.45)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v6a4 4 0 0 1 0 8v2" />
        <path d="M5 22v-2a7 7 0 0 1 14 0v2" />
      </svg>
    </div>
  )
}
