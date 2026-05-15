import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import type { VoiceAgent, Integration, Customer, PricingPlan } from '../types/db'
import { AppShell } from '../components/AppShell'

type Row = VoiceAgent & {
  customers: Pick<Customer, 'id' | 'name'> | null
  integrations: Pick<Integration, 'name' | 'platform' | 'region'> | null
  pricing_plans: Pick<PricingPlan, 'name' | 'type'> | null
  customer_subscriptions: { status: string }[]
}

export function AgentsList() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  const filtered = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase().trim()
    return agents.filter(
      (a) =>
        (a.display_name ?? '').toLowerCase().includes(q) ||
        (a.customers?.name ?? '').toLowerCase().includes(q) ||
        (a.integrations?.name ?? '').toLowerCase().includes(q),
    )
  }, [agents, search])

  return (
    <AppShell
      pageEyebrow="Voice-Agenten"
      pageTitle={
        <>
          Alle <span className="heading-accent">Agenten</span>
        </>
      }
    >
      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          count={filtered.length}
          total={agents.length}
          placeholder="Nach Agent, Kunde oder Integration suchen…"
          unit="Agent"
          unitPlural="Agenten"
        />
      </div>

      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : agents.length === 0 ? (
        <div className="glass-card-lg p-12 text-center">
          <h3 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Agenten</span>
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Geh zu einem Kunden und füge dort einen Voice-Agent hinzu.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">
          Keine Agenten gefunden für "<strong className="text-ink">{search}</strong>".
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a, i) => {
            const sub = a.customer_subscriptions?.[0]
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.4 }}
                whileHover={{ y: -2 }}
                onClick={() => navigate(`/admin/agents/${a.id}`)}
                className="group rounded-2xl glass p-5 text-left transition-all hover:shadow-glass-lg"
              >
                <div className="flex items-start gap-3">
                  <AgentBadge />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold tracking-tight text-ink">
                      {a.display_name ?? 'Unbenannter Agent'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {a.customers?.name ?? 'Kein Kunde'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {a.integrations && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">via</span>
                      <span className="font-medium text-ink-soft">
                        {a.integrations.name}
                        {a.integrations.region ? ` · ${a.integrations.region.toUpperCase()}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">Pricing</span>
                    {a.pricing_plans ? (
                      <span className="pill-brand">{a.pricing_plans.name}</span>
                    ) : (
                      <span className="text-ink-dim">— kein Plan —</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/40 pt-3">
                  {sub?.status === 'active' ? (
                    <span className="pill-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktiv
                    </span>
                  ) : sub ? (
                    <span className="pill-warn">{sub.status}</span>
                  ) : (
                    <span className="pill-neutral">Kein Abo</span>
                  )}
                  <span
                    className="text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--accent-700)' }}
                  >
                    Öffnen →
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

function SearchBar({
  value,
  onChange,
  count,
  total,
  placeholder,
  unit,
  unitPlural,
}: {
  value: string
  onChange: (v: string) => void
  count: number
  total: number
  placeholder: string
  unit: string
  unitPlural: string
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glass-input w-full pl-12 pr-32"
        style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-ink-muted">
        {value.trim() ? (
          <span>
            {count} von {total}
          </span>
        ) : (
          <span>
            {total} {total === 1 ? unit : unitPlural}
          </span>
        )}
      </div>
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
