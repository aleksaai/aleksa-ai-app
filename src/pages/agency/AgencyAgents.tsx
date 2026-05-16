// /agency/agents — list of voice-agents across all agency customers.
// Phase C: read-only list. Phase E wires up creation/editing.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AgencyShell } from '../../components/AgencyShell'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

type AgentRow = {
  id: string
  display_name: string | null
  platform_agent_id: string
  customer_id: string
  customer_name: string | null
  active: boolean
  created_at: string
}

export function AgencyAgents() {
  const { profile } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.agency_id) return
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('voice_agents')
        .select('id, display_name, platform_agent_id, customer_id, active, created_at, customers(name)')
        .order('created_at', { ascending: false })
      if (error) {
        setError(error.message)
      } else {
        const rows = (data ?? []).map((r: any) => ({
          id: r.id,
          display_name: r.display_name,
          platform_agent_id: r.platform_agent_id,
          customer_id: r.customer_id,
          customer_name: r.customers?.name ?? null,
          active: r.active,
          created_at: r.created_at,
        }))
        setAgents(rows)
      }
      setLoading(false)
    }
    void load()
  }, [profile?.agency_id])

  return (
    <AgencyShell
      pageEyebrow="Voice-Agents"
      pageTitle={<>Alle deine <span className="heading-accent">Agents</span></>}
    >
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          Fehler beim Laden: {error}
        </div>
      ) : agents.length === 0 ? (
        <div className="glass-card-lg p-10 text-center">
          <p className="text-base font-medium text-ink">Noch keine Voice-Agents</p>
          <p className="mt-2 text-sm text-ink-muted">
            Lege erst einen Kunden an, dann kannst du diesem einen Voice-Agent zuweisen.
          </p>
          <Link to="/agency" className="btn-primary mt-5 inline-flex">
            Zu den Kunden
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <ul className="divide-y divide-white/60">
            {agents.map((a) => (
              <li key={a.id} className="px-5 py-4 transition-colors hover:bg-white/50">
                <Link to={`/agency/agents/${a.id}`} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{a.display_name ?? a.platform_agent_id}</p>
                    <p className="text-xs text-ink-muted">Kunde: {a.customer_name ?? '–'}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {a.active ? <span className="pill-success">aktiv</span> : <span className="pill-neutral">inaktiv</span>}
                    <span className="text-ink-muted">
                      {new Date(a.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AgencyShell>
  )
}
