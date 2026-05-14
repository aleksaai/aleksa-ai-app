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
  adminListKbDocs,
  adminCreateKbDoc,
  adminUpdateAgentKb,
  type AgentConfig,
  type Voice,
  type KBDoc,
  type KBEntry,
} from '../lib/api'

type AgentRow = VoiceAgent & {
  customers: Pick<Customer, 'id' | 'name'> | null
  integrations: Pick<Integration, 'id' | 'name' | 'platform' | 'region'> | null
}

type Tab = 'overview' | 'prompt' | 'voice' | 'kb'

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

  // Knowledge Base
  const [workspaceKb, setWorkspaceKb] = useState<KBDoc[]>([])
  const [workspaceKbLoading, setWorkspaceKbLoading] = useState(false)
  const [assignedKb, setAssignedKb] = useState<KBEntry[]>([])
  const [ragEnabled, setRagEnabled] = useState(false)
  const [kbModalOpen, setKbModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [newKbText, setNewKbText] = useState('')
  const [kbCreating, setKbCreating] = useState(false)
  const [kbError, setKbError] = useState('')

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
          setAssignedKb(cfg.knowledge_base ?? [])
          setRagEnabled(cfg.rag_enabled ?? false)
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

  useEffect(() => {
    if (tab !== 'kb' || !agent?.integrations?.id || workspaceKb.length > 0) return
    setWorkspaceKbLoading(true)
    adminListKbDocs(agent.integrations.id)
      .then((docs) => setWorkspaceKb(docs))
      .catch((e) => console.error('list KB failed:', e))
      .finally(() => setWorkspaceKbLoading(false))
  }, [tab, agent, workspaceKb.length])

  const refreshWorkspaceKb = async () => {
    if (!agent?.integrations?.id) return
    setWorkspaceKbLoading(true)
    try {
      const docs = await adminListKbDocs(agent.integrations.id)
      setWorkspaceKb(docs)
    } finally {
      setWorkspaceKbLoading(false)
    }
  }

  const handleAddKbToAgent = (doc: KBDoc) => {
    if (assignedKb.find((e) => e.id === doc.id)) return
    setAssignedKb([
      ...assignedKb,
      { id: doc.id, name: doc.name, type: (doc.type as KBEntry['type']) ?? 'text', usage_mode: 'auto' },
    ])
  }

  const handleRemoveKbFromAgent = (docId: string) => {
    setAssignedKb(assignedKb.filter((e) => e.id !== docId))
  }

  const handleCreateNewKb = async () => {
    if (!agent?.integrations?.id || !newKbName.trim() || !newKbText.trim()) return
    setKbCreating(true)
    setKbError('')
    try {
      const doc = await adminCreateKbDoc({
        integration_id: agent.integrations.id,
        name: newKbName.trim(),
        text: newKbText,
      })
      // Add to workspace list + auto-assign to agent
      setWorkspaceKb([doc, ...workspaceKb])
      setAssignedKb([
        ...assignedKb,
        { id: doc.id, name: doc.name, type: 'text', usage_mode: 'auto' },
      ])
      setKbModalOpen(false)
      setNewKbName('')
      setNewKbText('')
    } catch (e) {
      setKbError(e instanceof Error ? e.message : String(e))
    } finally {
      setKbCreating(false)
    }
  }

  const kbChanged =
    config !== null &&
    (JSON.stringify(assignedKb.map((e) => e.id).sort()) !==
      JSON.stringify((config.knowledge_base ?? []).map((e) => e.id).sort()) ||
      ragEnabled !== config.rag_enabled)

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !config) return
    setSaving(true)
    setSaveError('')

    try {
      // 1. Patch prompt/first_message/voice if changed
      const patch: { voice_agent_id: string; prompt?: string; first_message?: string; voice_id?: string } = {
        voice_agent_id: id,
      }
      if (prompt !== config.prompt) patch.prompt = prompt
      if (firstMessage !== config.first_message) patch.first_message = firstMessage
      if (selectedVoice && selectedVoice !== config.voice_id) patch.voice_id = selectedVoice

      if (Object.keys(patch).length > 1) {
        await adminUpdateAgentConfig(patch)
      }

      // 2. Patch knowledge_base if changed
      if (kbChanged) {
        await adminUpdateAgentKb({
          voice_agent_id: id,
          knowledge_base: assignedKb,
          rag_enabled: ragEnabled,
        })
      }

      setSavedAt(Date.now())
      // Refresh config to reflect new state
      const cfg = await adminGetAgentConfig(id)
      setConfig(cfg)
      setAssignedKb(cfg.knowledge_base ?? [])
      setRagEnabled(cfg.rag_enabled ?? false)
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
      (selectedVoice !== '' && selectedVoice !== config.voice_id) ||
      kbChanged)

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
              {(['overview', 'prompt', 'voice', 'kb'] as Tab[]).map((t) => (
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
                  {t === 'kb' && 'Wissensdatenbank'}
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

              {tab === 'kb' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Header */}
                  <div className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold">Wissensdatenbank-Dokumente</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Dokumente die dem Agent für RAG-basierte Antworten zur Verfügung stehen.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setKbModalOpen(true)}
                        className="btn-primary text-sm"
                      >
                        + Neuer Doc
                      </button>
                    </div>

                    <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-medium">RAG aktiviert</p>
                        <p className="text-xs text-slate-500">
                          Wenn an: Agent durchsucht KB-Docs während des Gesprächs (etwas mehr Latenz, dafür präzisere Antworten)
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ragEnabled}
                        onChange={(e) => setRagEnabled(e.target.checked)}
                        className="h-5 w-5"
                      />
                    </label>
                  </div>

                  {/* Assigned to this agent */}
                  <div className="card">
                    <h4 className="mb-3 text-sm font-medium">Diesem Agent zugewiesen ({assignedKb.length})</h4>
                    {assignedKb.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Keine Docs zugewiesen. Unten aus deinem Workspace adden oder neu erstellen.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {assignedKb.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 p-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{e.name}</p>
                              <p className="font-mono text-xs text-slate-500">{e.id}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveKbFromAgent(e.id)}
                              className="btn-ghost text-xs text-red-600"
                            >
                              Entfernen
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Workspace KB list */}
                  <div className="card">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-medium">Im Workspace verfügbar</h4>
                      <button type="button" onClick={refreshWorkspaceKb} className="btn-ghost text-xs">
                        🔄 Neu laden
                      </button>
                    </div>
                    {workspaceKbLoading ? (
                      <p className="text-xs text-slate-500">Lade ElevenLabs Workspace-KB…</p>
                    ) : workspaceKb.length === 0 ? (
                      <p className="text-xs text-slate-500">Noch keine Docs im Workspace. Klick oben auf "+ Neuer Doc".</p>
                    ) : (
                      <div className="space-y-2">
                        {workspaceKb.map((d) => {
                          const alreadyAssigned = assignedKb.some((e) => e.id === d.id)
                          return (
                            <div
                              key={d.id}
                              className="flex items-center justify-between rounded-lg border border-slate-200 p-2"
                            >
                              <div>
                                <p className="text-sm font-medium">{d.name}</p>
                                <p className="font-mono text-xs text-slate-500">
                                  {d.id} · {d.type}
                                </p>
                              </div>
                              {alreadyAssigned ? (
                                <span className="text-xs text-emerald-600">✓ zugewiesen</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddKbToAgent(d)}
                                  className="btn-ghost text-xs"
                                >
                                  + Zuweisen
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
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

            {/* New KB Doc Modal */}
            {kbModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setKbModalOpen(false)}>
                <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-xl font-semibold">Neuen KB-Doc erstellen</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Wird in deinem ElevenLabs Workspace gespeichert + direkt diesem Agent zugewiesen.
                  </p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                      <input
                        type="text"
                        value={newKbName}
                        onChange={(e) => setNewKbName(e.target.value)}
                        placeholder="z.B. VV-Cars Preisliste 2026"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Inhalt (Text)</label>
                      <textarea
                        value={newKbText}
                        onChange={(e) => setNewKbText(e.target.value)}
                        rows={15}
                        className="input font-mono text-xs"
                        placeholder="Hier den vollständigen Text einfügen — wird vom Agent über RAG durchsucht."
                      />
                    </div>
                    {kbError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{kbError}</div>
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setKbModalOpen(false)} className="btn-ghost flex-1" disabled={kbCreating}>
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateNewKb}
                        disabled={kbCreating || !newKbName.trim() || !newKbText.trim()}
                        className="btn-primary flex-1"
                      >
                        {kbCreating ? 'Erstelle…' : 'Erstellen + Zuweisen'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
