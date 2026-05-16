// /agency/customers/:id — partner's view of a single customer.
// Shows the customer profile + their assigned voice agents.

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AgencyShell } from '../../components/AgencyShell'
import { supabase } from '../../lib/supabase'
import type { Customer } from '../../types/db'

type AgentRow = {
  id: string
  display_name: string | null
  platform_agent_id: string
  active: boolean
}

export function AgencyCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      const [{ data: c }, { data: a }] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('voice_agents')
          .select('id, display_name, platform_agent_id, active')
          .eq('customer_id', id)
          .order('created_at', { ascending: false }),
      ])
      setCustomer((c as Customer | null) ?? null)
      setAgents((a ?? []) as AgentRow[])
      setLoading(false)
    }
    void load()
  }, [id])

  if (loading) {
    return (
      <AgencyShell pageEyebrow="Kunde" pageTitle="Lade…" backTo="/agency/customers" backLabel="Zur Kundenliste">
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade Kunden-Daten…</div>
      </AgencyShell>
    )
  }

  if (!customer) {
    return (
      <AgencyShell pageEyebrow="Kunde" pageTitle="Nicht gefunden" backTo="/agency/customers" backLabel="Zur Kundenliste">
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          Kunde nicht gefunden — vielleicht gehört er nicht zu deiner Agency.
        </div>
      </AgencyShell>
    )
  }

  return (
    <AgencyShell
      pageEyebrow="Kunde"
      pageTitle={<>{customer.name}</>}
      backTo="/agency/customers"
      backLabel="Zur Kundenliste"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <section className="glass-card-lg p-7">
            <p className="eyebrow mb-2">Voice-Agents</p>
            <h2 className="text-xl font-semibold tracking-tight">Zugewiesene Agents</h2>
            {agents.length === 0 ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800">
                Noch kein Voice-Agent zugewiesen. Phase E fügt hier den "Voice-Agent zuweisen"-Dialog hinzu —
                wenn du sofort einen brauchst, sag Aleksa Bescheid.
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-white/60">
                {agents.map((a) => (
                  <li key={a.id} className="py-3">
                    <Link to={`/agency/agents/${a.id}`} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">
                        {a.display_name ?? a.platform_agent_id}
                      </span>
                      {a.active ? <span className="pill-success">aktiv</span> : <span className="pill-neutral">inaktiv</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="glass-card p-5">
            <p className="eyebrow mb-2">Kunden-Info</p>
            <div className="space-y-3">
              <div>
                <p className="label-soft mb-0.5">Email</p>
                <p className="text-sm text-ink">{customer.contact_email}</p>
              </div>
              <div>
                <p className="label-soft mb-0.5">Angelegt</p>
                <p className="text-sm text-ink">
                  {new Date(customer.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="label-soft mb-0.5">Zahlungsmethode</p>
                <p className="text-sm text-ink">
                  {customer.has_payment_method ? '✓ hinterlegt' : '— noch nicht'}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AgencyShell>
  )
}
