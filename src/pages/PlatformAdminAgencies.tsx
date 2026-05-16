// /platform-admin/agencies — Aleksa's overview of all agencies.
// Admin RLS bypass lets us read everything across all tenants in one query.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { supabase } from '../lib/supabase'
import type { Agency } from '../types/db'

type AgencyRow = Agency & {
  customer_count: number
  voice_agent_count: number
  calls_30d: number
}

export function PlatformAdminAgencies() {
  const [agencies, setAgencies] = useState<AgencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: agenciesData, error: agErr } = await supabase
        .from('agencies')
        .select('*')
        .order('created_at', { ascending: false })
      if (agErr) {
        setError(agErr.message)
        setLoading(false)
        return
      }
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const enriched: AgencyRow[] = await Promise.all(
        ((agenciesData ?? []) as Agency[]).map(async (a) => {
          const [customers, agents, calls] = await Promise.all([
            supabase.from('customers').select('id', { count: 'exact', head: true }).eq('agency_id', a.id),
            supabase
              .from('voice_agents')
              .select('id, customers!inner(agency_id)', { count: 'exact', head: true })
              .eq('customers.agency_id', a.id),
            supabase
              .from('calls')
              .select('id, customers!inner(agency_id)', { count: 'exact', head: true })
              .eq('customers.agency_id', a.id)
              .gte('started_at', cutoff),
          ])
          return {
            ...a,
            customer_count: customers.count ?? 0,
            voice_agent_count: agents.count ?? 0,
            calls_30d: calls.count ?? 0,
          }
        }),
      )
      setAgencies(enriched)
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <AppShell
      pageEyebrow="Platform-Admin"
      pageTitle={<>Alle <span className="heading-accent">Agencies</span></>}
    >
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">{error}</div>
      ) : agencies.length === 0 ? (
        <div className="glass-card-lg p-12 text-center">
          <h3 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Agencies</span>
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Sobald du eine access-Anfrage genehmigst und der Partner das Onboarding abschließt, erscheint er hier.
          </p>
          <Link to="/admin/requests" className="btn-primary mt-5 inline-flex">Zu den Anfragen</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {agencies.map((a) => (
            <Link
              key={a.id}
              to={`/platform-admin/agencies/${a.id}`}
              className="glass-card block p-5 transition-shadow hover:shadow-lg"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {a.logo_url ? (
                    <img src={a.logo_url} alt={a.display_name} className="h-12 w-12 shrink-0 rounded-xl border border-white/60 object-contain p-1" />
                  ) : (
                    <div
                      className="h-12 w-12 shrink-0 rounded-xl border border-white/60"
                      style={{ background: a.brand_color }}
                    />
                  )}
                  <div>
                    <p className="text-base font-semibold tracking-tight text-ink">{a.display_name}</p>
                    <p className="text-xs text-ink-muted">
                      {a.slug}.openpenguin.de
                      {a.custom_domain && (
                        <> · <code className="rounded bg-white/60 px-1 py-0.5">{a.custom_domain}</code></>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <Stat label="Kunden" value={a.customer_count} />
                  <Stat label="Agents" value={a.voice_agent_count} />
                  <Stat label="Anrufe 30d" value={a.calls_30d} />
                  <StatusPill status={a.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  if (status === 'active') return <span className="pill-success">aktiv</span>
  if (status === 'suspended') return <span className="pill-warn">suspendiert</span>
  return <span className="pill-neutral">{status}</span>
}
