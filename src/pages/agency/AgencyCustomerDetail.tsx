// /agency/customers/:id — partner's view of a single customer.
// Shows the customer profile + their assigned voice agents. Phase E voll
// adds the "Voice-Agent zuweisen" dialog.

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AgencyShell } from '../../components/AgencyShell'
import { supabase } from '../../lib/supabase'
import { agencyListPlatformAgents, agencyCreateVoiceAgent } from '../../lib/api'
import type { Customer, Integration } from '../../types/db'

type AgentRow = {
  id: string
  display_name: string | null
  platform_agent_id: string
  active: boolean
}

type AvailablePlatformAgent = {
  platform_agent_id: string
  name: string
  platform_phone_number_id?: string
  phone_number_e164?: string
}

export function AgencyCustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)

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
      <AgencyShell pageEyebrow="Kunde" pageTitle="Lade…" backTo="/agency" backLabel="Zur Kundenliste">
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade Kunden-Daten…</div>
      </AgencyShell>
    )
  }

  if (!customer) {
    return (
      <AgencyShell pageEyebrow="Kunde" pageTitle="Nicht gefunden" backTo="/agency" backLabel="Zur Kundenliste">
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
      backTo="/agency"
      backLabel="Zur Kundenliste"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <section className="glass-card-lg p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow mb-2">Voice-Agents</p>
                <h2 className="text-xl font-semibold tracking-tight">Zugewiesene Agents</h2>
              </div>
              <button onClick={() => setAssignOpen(true)} className="btn-primary text-sm">+ Zuweisen</button>
            </div>

            {agents.length === 0 ? (
              <div className="mt-5 rounded-xl bg-white/40 p-4 text-sm text-ink-muted">
                Noch kein Voice-Agent zugewiesen. Klick auf "Zuweisen" um einen
                bestehenden Agent aus einer deiner Integrationen zu wählen.
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

            {assignOpen && id && (
              <AssignVoiceAgentForm
                customerId={id}
                onClose={() => setAssignOpen(false)}
                onCreated={async () => {
                  setAssignOpen(false)
                  // reload agents
                  const { data: a } = await supabase
                    .from('voice_agents')
                    .select('id, display_name, platform_agent_id, active')
                    .eq('customer_id', id)
                    .order('created_at', { ascending: false })
                  setAgents((a ?? []) as AgentRow[])
                }}
              />
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

function AssignVoiceAgentForm({
  customerId,
  onClose,
  onCreated,
}: {
  customerId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationId, setIntegrationId] = useState<string>('')
  const [availableAgents, setAvailableAgents] = useState<AvailablePlatformAgent[]>([])
  const [selectedPlatformAgentId, setSelectedPlatformAgentId] = useState<string>('')
  const [displayName, setDisplayName] = useState('')
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('integrations')
      .select('id, name, platform, region, agency_id, active, created_at, updated_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setIntegrations((data ?? []) as Integration[])
        if (data && data.length > 0) setIntegrationId(data[0].id)
      })
  }, [])

  useEffect(() => {
    if (!integrationId) return
    setLoadingAgents(true)
    setError(null)
    void agencyListPlatformAgents(integrationId)
      .then((r) => setAvailableAgents(r.agents))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingAgents(false))
  }, [integrationId])

  const selectedAgent = availableAgents.find((a) => a.platform_agent_id === selectedPlatformAgentId)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!integrationId || !selectedPlatformAgentId) return
    setBusy(true)
    setError(null)
    try {
      await agencyCreateVoiceAgent({
        customer_id: customerId,
        integration_id: integrationId,
        platform_agent_id: selectedPlatformAgentId,
        platform_phone_number_id: selectedAgent?.platform_phone_number_id,
        display_name: displayName.trim() || selectedAgent?.name || undefined,
      })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border border-white/60 bg-white/40 p-5">
      <div>
        <label className="label-soft mb-1.5 block">Integration</label>
        {integrations.length === 0 ? (
          <p className="text-sm text-amber-800">
            Noch keine Integration —{' '}
            <Link to="/agency/integrations" className="underline">
              erst eine Provider-Verbindung anlegen
            </Link>
            .
          </p>
        ) : (
          <select
            value={integrationId}
            onChange={(e) => setIntegrationId(e.target.value)}
            className="glass-input"
            disabled={busy}
          >
            {integrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.platform})
              </option>
            ))}
          </select>
        )}
      </div>

      {integrationId && (
        <div>
          <label className="label-soft mb-1.5 block">Voice-Agent aus Provider</label>
          {loadingAgents ? (
            <p className="text-sm text-ink-muted">Lade Agents…</p>
          ) : availableAgents.length === 0 ? (
            <p className="text-sm text-ink-muted">Keine Agents in dieser Integration gefunden.</p>
          ) : (
            <select
              value={selectedPlatformAgentId}
              onChange={(e) => setSelectedPlatformAgentId(e.target.value)}
              className="glass-input"
              required
              disabled={busy}
            >
              <option value="">— wählen —</option>
              {availableAgents.map((a) => (
                <option key={a.platform_agent_id} value={a.platform_agent_id}>
                  {a.name}
                  {a.phone_number_e164 ? ` (${a.phone_number_e164})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {selectedPlatformAgentId && (
        <div>
          <label className="label-soft mb-1.5 block">Anzeigename (intern, optional)</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={selectedAgent?.name ?? ''}
            className="glass-input"
            maxLength={80}
            disabled={busy}
          />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="btn-ghost flex-1">Abbrechen</button>
        <button type="submit" disabled={busy || !integrationId || !selectedPlatformAgentId} className="btn-primary flex-1">
          {busy ? 'Weise zu…' : 'Voice-Agent zuweisen'}
        </button>
      </div>
    </form>
  )
}
