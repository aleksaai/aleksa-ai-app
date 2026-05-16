// /agency/integrations — partner manages their own provider API keys
// (ElevenLabs, Retell, Vapi, OpenAI). Visible only to agency_owner.

import { useEffect, useState, type FormEvent } from 'react'
import { AgencyShell } from '../../components/AgencyShell'
import { supabase } from '../../lib/supabase'
import { agencyCreateIntegration } from '../../lib/api'
import type { Integration, IntegrationPlatform } from '../../types/db'

const PLATFORM_LABELS: Record<IntegrationPlatform, string> = {
  elevenlabs: 'ElevenLabs',
  retellai: 'Retell AI',
  vapi: 'Vapi',
  openai: 'OpenAI',
}

export function AgencyIntegrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('integrations')
      .select('id, name, platform, region, agency_id, active, created_at, updated_at')
      .order('created_at', { ascending: false })
    setIntegrations((data ?? []) as Integration[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  return (
    <AgencyShell
      pageEyebrow="Integrationen"
      pageTitle={<>Deine <span className="heading-accent">Provider</span></>}
      pageAction={
        !showForm ? (
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Neue Integration</button>
        ) : null
      }
    >
      {showForm && <NewIntegrationForm onDone={() => { setShowForm(false); void load() }} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="mt-4 glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : integrations.length === 0 && !showForm ? (
        <div className="glass-card-lg p-10 text-center">
          <p className="text-base font-medium text-ink">Noch keine Integration</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Verbinde deinen ElevenLabs- oder Retell-Account, damit du Voice-Agents
            an deine Kunden vergeben kannst.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-5 inline-flex">
            Erste Integration hinzufügen
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {integrations.map((i) => (
            <div key={i.id} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{i.name}</p>
                  <p className="text-xs text-ink-muted">
                    {PLATFORM_LABELS[i.platform] ?? i.platform}
                    {i.region && ` · Region: ${i.region.toUpperCase()}`}
                    {i.agency_id === null && ' · ⚙ Platform-Default'}
                  </p>
                </div>
                <div>
                  {i.active ? <span className="pill-success">aktiv</span> : <span className="pill-neutral">inaktiv</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AgencyShell>
  )
}

function NewIntegrationForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<IntegrationPlatform>('elevenlabs')
  const [apiKey, setApiKey] = useState('')
  const [region, setRegion] = useState<'us' | 'eu'>('eu')
  const [vapiPublic, setVapiPublic] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const payload: any = { name: name.trim(), platform, api_key: apiKey.trim() }
      if (platform === 'elevenlabs') payload.region = region
      if (platform === 'vapi') payload.vapi_public_key = vapiPublic.trim()
      await agencyCreateIntegration(payload)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card-lg mb-6 max-w-2xl space-y-4 p-7">
      <div>
        <p className="eyebrow mb-2">Neue Integration</p>
        <h3 className="text-lg font-semibold tracking-tight">Provider-Account verknüpfen</h3>
      </div>

      <div>
        <label className="label-soft mb-1.5 block">Plattform</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as IntegrationPlatform)}
          className="glass-input"
          disabled={busy}
        >
          <option value="elevenlabs">ElevenLabs</option>
          <option value="retellai">Retell AI</option>
          <option value="vapi">Vapi</option>
          <option value="openai">OpenAI</option>
        </select>
      </div>

      <div>
        <label className="label-soft mb-1.5 block">Anzeigename (intern)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={platform === 'elevenlabs' ? 'Mein ElevenLabs-Account' : 'Mein Provider-Account'}
          className="glass-input"
          required
          maxLength={80}
          disabled={busy}
        />
      </div>

      <div>
        <label className="label-soft mb-1.5 block">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={platform === 'elevenlabs' ? 'sk_...' : platform === 'retellai' ? 'key_...' : '...'}
          className="glass-input font-mono"
          required
          disabled={busy}
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Wird verschlüsselt gespeichert. Wir nutzen den Key nur um Agents in deinem Auftrag zu listen + Calls zu tracken.
        </p>
      </div>

      {platform === 'elevenlabs' && (
        <div>
          <label className="label-soft mb-1.5 block">Region</label>
          <select value={region} onChange={(e) => setRegion(e.target.value as 'us' | 'eu')} className="glass-input" disabled={busy}>
            <option value="eu">EU (api.eu.elevenlabs.io)</option>
            <option value="us">US (api.elevenlabs.io)</option>
          </select>
        </div>
      )}

      {platform === 'vapi' && (
        <div>
          <label className="label-soft mb-1.5 block">Vapi Public Key</label>
          <input
            type="text"
            value={vapiPublic}
            onChange={(e) => setVapiPublic(e.target.value)}
            className="glass-input font-mono"
            required
            disabled={busy}
          />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost flex-1">Abbrechen</button>
        <button type="submit" disabled={busy || !name || !apiKey} className="btn-primary flex-1">
          {busy ? 'Speichere…' : 'Integration anlegen'}
        </button>
      </div>
    </form>
  )
}
