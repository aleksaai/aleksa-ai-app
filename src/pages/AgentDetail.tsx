import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { VoiceAgent, Integration, Customer } from '../types/db'
import {
  adminGetAgentConfig,
  adminUpdateAgentConfig,
  adminListVoices,
  type AgentConfig,
  type Voice,
} from '../lib/api'

type AgentRow = VoiceAgent & {
  customers: Pick<Customer, 'id' | 'name'> | null
  integrations: Pick<Integration, 'id' | 'name' | 'platform' | 'region'> | null
}

type Tab = 'overview' | 'prompt' | 'voice'

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, signOut } = useAuth()
  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  // Editable state
  const [prompt, setPrompt] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')

  // Voice picker
  const [voices, setVoices] = useState<Voice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      const { data: a } = await supabase
        .from('voice_agents')
        .select('*, customers(id, name), integrations(id, name, platform, region)')
        .eq('id', id)
        .maybeSingle()
      setAgent(a as AgentRow | null)

      if (a) {
        try {
          const cfg = await adminGetAgentConfig(id)
          setConfig(cfg)
          setPrompt(cfg.prompt)
          setFirstMessage(cfg.first_message)
          setSelectedVoice(cfg.voice_id ?? '')
        } catch (e) {
          console.error('Failed to load agent config:', e)
        }
      }
      setLoading(false)
    })()
  }, [id])

  useEffect(() => {
    if (tab !== 'voice' || !agent?.integrations?.id || voices.length > 0) return
    setVoicesLoading(true)
    adminListVoices(agent.integrations.id)
      .then((vs) => setVoices(vs))
      .catch((e) => console.error('list voices failed:', e))
      .finally(() => setVoicesLoading(false))
  }, [tab, agent, voices.length])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !config) return
    setSaving(true)
    setSaveError('')

    // Build diff: only send changed fields
    const patch: { voice_agent_id: string; prompt?: string; first_message?: string; voice_id?: string } = {
      voice_agent_id: id,
    }
    if (prompt !== config.prompt) patch.prompt = prompt
    if (firstMessage !== config.first_message) patch.first_message = firstMessage
    if (selectedVoice && selectedVoice !== config.voice_id) patch.voice_id = selectedVoice

    if (Object.keys(patch).length === 1) {
      setSaving(false)
      return
    }

    try {
      await adminUpdateAgentConfig(patch)
      setSavedAt(Date.now())
      // Refresh config to reflect new state
      const cfg = await adminGetAgentConfig(id)
      setConfig(cfg)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const hasUnsaved =
    config !== null &&
    (prompt !== config.prompt ||
      firstMessage !== config.first_message ||
      (selectedVoice !== '' && selectedVoice !== config.voice_id))

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-lg font-semibold">AleksaAI Admin</Link>
            <nav className="flex gap-1">
              <Link to="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Kunden</Link>
              <Link to="/admin/agents" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900">Agenten</Link>
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
          <Link to="/admin/agents" className="text-sm text-slate-500 hover:text-slate-900">← Zurück zu Agenten</Link>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade…</div>
        ) : !agent ? (
          <div className="card text-center text-sm text-red-700">Agent nicht gefunden.</div>
        ) : (
          <>
            <section className="card mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">{agent.display_name ?? agent.platform_agent_id}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Customer: <strong>{agent.customers?.name ?? '—'}</strong>
                    {agent.integrations && (
                      <> · via <strong>{agent.integrations.name}</strong>{' '}
                      ({agent.integrations.platform}{agent.integrations.region ? `, ${agent.integrations.region.toUpperCase()}` : ''})</>
                    )}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {savedAt && Date.now() - savedAt < 4000 && (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      ✓ Gespeichert
                    </span>
                  )}
                  {hasUnsaved && (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Ungesicherte Änderungen
                    </span>
                  )}
                </div>
              </div>
            </section>

            <div className="mb-4 flex gap-1 border-b border-slate-200">
              {(['overview', 'prompt', 'voice'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t
                      ? 'border-brand-500 text-brand-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'overview' && 'Übersicht'}
                  {t === 'prompt' && 'Prompt & Begrüßung'}
                  {t === 'voice' && 'Stimme'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {tab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card space-y-3">
                  <Field label="Display-Name" value={agent.display_name ?? '—'} />
                  <Field label="Platform Agent ID" value={agent.platform_agent_id} mono />
                  {agent.platform_phone_number_id && (
                    <Field label="Phone Number ID" value={agent.platform_phone_number_id} mono />
                  )}
                  {config && (
                    <>
                      <Field label="LLM-Modell" value={config.llm ?? '—'} />
                      <Field label="Sprache" value={config.language ?? '—'} />
                      <Field label="TTS-Modell" value={config.tts_model ?? '—'} />
                      <Field label="Aktuelle Voice-ID" value={config.voice_id ?? '—'} mono />
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'prompt' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Begrüßung (First Message)
                    </label>
                    <textarea
                      value={firstMessage}
                      onChange={(e) => setFirstMessage(e.target.value)}
                      rows={2}
                      className="input"
                      placeholder="Was der Agent als erstes sagt"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      System-Prompt
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={20}
                      className="input font-mono text-xs"
                      placeholder="Verhalten, Persönlichkeit, Regeln, Tools-Beschreibung..."
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Wird direkt an ElevenLabs gepatched. Tools/Webhooks bleiben unverändert
                      — die können nur über den Agent-Rebuild geändert werden (siehe Marcus' knowledge.md).
                    </p>
                  </div>
                </motion.div>
              )}

              {tab === 'voice' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
                  {voicesLoading ? (
                    <div className="text-sm text-slate-500">Lade Voices von ElevenLabs…</div>
                  ) : voices.length === 0 ? (
                    <div className="text-sm text-slate-500">Keine Voices verfügbar.</div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        Aktuell: <strong>{voices.find((v) => v.voice_id === config?.voice_id)?.name ?? config?.voice_id ?? '—'}</strong>
                      </p>
                      <div className="max-h-[500px] space-y-2 overflow-y-auto">
                        {voices.map((v) => (
                          <label
                            key={v.voice_id}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                              selectedVoice === v.voice_id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="voice"
                                checked={selectedVoice === v.voice_id}
                                onChange={() => setSelectedVoice(v.voice_id)}
                              />
                              <div>
                                <div className="text-sm font-medium">{v.name}</div>
                                <div className="font-mono text-xs text-slate-500">{v.voice_id}</div>
                                {Object.entries(v.labels).length > 0 && (
                                  <div className="mt-1 flex gap-1">
                                    {Object.entries(v.labels).slice(0, 4).map(([k, val]) => (
                                      <span key={k} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                        {val}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {v.preview_url && (
                              <audio src={v.preview_url} controls preload="none" className="h-8 max-w-[180px]" />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {saveError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="sticky bottom-4 z-10 flex justify-end">
                <button type="submit" disabled={saving || !hasUnsaved} className="btn-primary shadow-lg">
                  {saving ? 'Speichere…' : hasUnsaved ? 'Änderungen speichern' : 'Keine Änderungen'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
