import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import type {
  Customer,
  VoiceAgent,
  PricingPlan,
  Integration,
  CustomerPermissions,
} from '../types/db'
import { AddVoiceAgentDialog } from '../components/AddVoiceAgentDialog'
import { AssignPricingDialog } from '../components/AssignPricingDialog'
import { AppShell } from '../components/AppShell'

type AgentRow = VoiceAgent & {
  pricing_plans: PricingPlan | null
  integrations: Pick<Integration, 'name' | 'platform' | 'region'> | null
  customer_subscriptions: { id: string; status: string; stripe_subscription_id: string }[]
}

type PermKey = keyof Pick<
  CustomerPermissions,
  | 'can_edit_agent_config'
  | 'can_edit_kb'
  | 'can_view_calls'
  | 'can_view_transcripts'
  | 'can_view_audio'
>

const PERMISSIONS: { key: PermKey; label: string; hint: string }[] = [
  {
    key: 'can_edit_agent_config',
    label: 'Agent-Konfiguration',
    hint: 'System-Prompt, Begrüßung & Voice anpassen',
  },
  {
    key: 'can_edit_kb',
    label: 'Wissensdatenbank',
    hint: 'Dokumente erstellen, zuweisen, RAG steuern',
  },
  {
    key: 'can_view_calls',
    label: 'Anrufe einsehen',
    hint: 'Liste aller Calls mit Datum & Dauer',
  },
  {
    key: 'can_view_transcripts',
    label: 'Transkripte einsehen',
    hint: 'Vollständige Gesprächsverläufe',
  },
  {
    key: 'can_view_audio',
    label: 'Aufnahmen anhören',
    hint: 'Audio-Files der Calls',
  },
]

export function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [permissions, setPermissions] = useState<CustomerPermissions | null>(null)
  const [permSaving, setPermSaving] = useState<string | null>(null)
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
      .select(
        '*, pricing_plans(*), integrations(name, platform, region), customer_subscriptions(id, status, stripe_subscription_id)',
      )
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
    setAgents((a ?? []) as AgentRow[])

    const { data: p } = await supabase
      .from('customer_permissions')
      .select('*')
      .eq('customer_id', id)
      .maybeSingle()
    setPermissions(p as CustomerPermissions | null)

    setLoading(false)
  }

  const togglePermission = async (key: PermKey, value: boolean) => {
    if (!id || !permissions) return
    setPermSaving(key)
    const { error } = await supabase
      .from('customer_permissions')
      .update({ [key]: value })
      .eq('customer_id', id)
    if (!error) setPermissions({ ...permissions, [key]: value })
    setPermSaving(null)
  }

  useEffect(() => {
    load()
  }, [id])

  return (
    <AppShell backTo="/admin" backLabel="Zurück zur Übersicht">
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : !customer ? (
        <div className="glass-card p-10 text-center text-sm text-red-700">Kunde nicht gefunden.</div>
      ) : (
        <>
          {/* ============ HERO ============ */}
          <section className="relative overflow-hidden rounded-3xl glass-card-lg p-8">
            <div
              aria-hidden
              className="absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
            />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <BigAvatar name={customer.name} />
                <div>
                  <p className="eyebrow mb-1.5">Kundenprofil</p>
                  <h1 className="text-3xl font-semibold tracking-tight">{customer.name}</h1>
                  <p className="mt-1 text-sm text-ink-muted">{customer.contact_email}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {customer.has_payment_method ? (
                      <span className="pill-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Zahlungsmethode hinterlegt
                      </span>
                    ) : (
                      <span className="pill-warn">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Onboarding ausstehend
                      </span>
                    )}
                    <span className="pill-neutral">
                      Seit{' '}
                      {new Date(customer.created_at).toLocaleDateString('de-DE', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <Link
                to={`/admin/customers/${customer.id}/view`}
                className="btn-ghost shrink-0"
              >
                <EyeIcon /> Als Kunde ansehen
              </Link>
            </div>
          </section>

          {/* ============ KUNDENZUGRIFF ============ */}
          {permissions && (
            <section className="mt-8">
              <div className="mb-4">
                <p className="eyebrow mb-1">Kundenzugriff</p>
                <h2 className="text-xl font-semibold tracking-tight">
                  Was {customer.name} <span className="heading-accent">sehen darf</span>
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Permission-Toggles steuern, welche Bereiche im Kunden-Dashboard sichtbar und editierbar sind.
                </p>
              </div>

              <div className="glass-card divide-y divide-white/40">
                {PERMISSIONS.map(({ key, label, hint }) => (
                  <PermissionRow
                    key={key}
                    label={label}
                    hint={hint}
                    on={Boolean(permissions[key])}
                    busy={permSaving === key}
                    onChange={(v) => togglePermission(key, v)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ============ VOICE AGENTS ============ */}
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="eyebrow mb-1">Voice-Agenten</p>
                <h2 className="text-xl font-semibold tracking-tight">
                  Aktive <span className="heading-accent">Agenten</span>
                </h2>
              </div>
              <button onClick={() => setAddAgentOpen(true)} className="btn-primary">
                <PlusIcon /> Agent hinzufügen
              </button>
            </div>

            {agents.length === 0 ? (
              <div className="glass-card-lg p-10 text-center">
                <p className="text-sm text-ink-muted">
                  Noch keine Agenten verknüpft. Klick oben auf <strong className="text-ink">Agent hinzufügen</strong>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.map((a, i) => {
                  const activeSub = a.customer_subscriptions?.find(
                    (s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due',
                  )
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group rounded-2xl glass p-5 transition-all hover:shadow-glass-lg"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <AgentIconBadge />
                          <div>
                            <h3 className="font-semibold tracking-tight">
                              {a.display_name ?? 'Unbenannter Agent'}
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              {a.integrations ? (
                                <>
                                  via <span className="font-medium text-ink-soft">{a.integrations.name}</span>
                                  {a.integrations.region ? ` · ${a.integrations.region.toUpperCase()}` : ''}
                                </>
                              ) : (
                                'Keine Integration zugeordnet'
                              )}
                              {a.platform_phone_number_id && (
                                <span className="ml-2 inline-flex items-center gap-1 text-brand-700">
                                  <PhoneIcon /> Telefonnummer aktiv
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          {a.pricing_plans ? (
                            <div className="text-right">
                              <span className="pill-brand">{a.pricing_plans.name}</span>
                              {activeSub && (
                                <p className="mt-1 text-[11px] text-ink-muted">
                                  {activeSub.status === 'active' ? 'Aktiv' : activeSub.status}
                                </p>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssignAgent(a)}
                              disabled={!customer.has_payment_method}
                              className="btn-ghost text-xs"
                              title={
                                !customer.has_payment_method
                                  ? 'Kunde hat noch keine Zahlungsmethode hinterlegt'
                                  : ''
                              }
                            >
                              + Pricing zuweisen
                            </button>
                          )}
                          <Link
                            to={`/admin/agents/${a.id}`}
                            className="text-sm font-medium text-brand-700 opacity-60 transition-opacity hover:opacity-100"
                          >
                            Öffnen →
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </section>

          <AddVoiceAgentDialog
            open={addAgentOpen}
            customerId={customer.id}
            onClose={() => setAddAgentOpen(false)}
            onCreated={load}
          />
          <AssignPricingDialog
            open={!!assignAgent}
            voiceAgentId={assignAgent?.id ?? ''}
            voiceAgentName={assignAgent?.display_name ?? 'Agent'}
            onClose={() => setAssignAgent(null)}
            onAssigned={load}
          />
        </>
      )}
    </AppShell>
  )
}

function PermissionRow({
  label,
  hint,
  on,
  busy,
  onChange,
}: {
  label: string
  hint: string
  on: boolean
  busy: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => !busy && onChange(!on)}
      disabled={busy}
      className="flex w-full items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-white/30 disabled:opacity-60"
    >
      <div>
        <p className="font-medium tracking-tight text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      </div>
      <div className={`toggle ${on ? 'toggle-on' : ''}`} aria-hidden>
        <span className="toggle-thumb" />
      </div>
    </button>
  )
}

function BigAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold text-white"
      style={{
        background: 'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 8px 24px -8px rgba(var(--accent-shadow-rgb),0.55)',
      }}
    >
      {initials}
    </div>
  )
}

function AgentIconBadge() {
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(var(--accent-400-rgb),0.25) 0%, rgba(var(--accent-400-rgb),0.18) 100%)',
        border: '1px solid rgba(var(--accent-400-rgb),0.3)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v6m0 0a4 4 0 1 1-4 4 4 4 0 0 1 4-4z" />
        <path d="M5 22v-2a7 7 0 0 1 14 0v2" />
      </svg>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
