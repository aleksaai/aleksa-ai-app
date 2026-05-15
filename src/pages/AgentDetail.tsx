import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
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
import { AppShell } from '../components/AppShell'

type AgentRow = VoiceAgent & {
  customers: Pick<Customer, 'id' | 'name'> | null
  integrations: Pick<Integration, 'id' | 'name' | 'platform' | 'region'> | null
}

type Tab = 'overview' | 'prompt' | 'voice' | 'kb'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'voice', label: 'Stimme' },
  { key: 'kb', label: 'Wissen' },
]

export function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  const [prompt, setPrompt] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')

  const [voices, setVoices] = useState<Voice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)

  const [workspaceKb, setWorkspaceKb] = useState<KBDoc[]>([])
  const [workspaceKbLoading, setWorkspaceKbLoading] = useState(false)
  const [assignedKb, setAssignedKb] = useState<KBEntry[]>([])
  const [ragEnabled, setRagEnabled] = useState(false)
  const [kbModalOpen, setKbModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [newKbText, setNewKbText] = useState('')
  const [kbCreating, setKbCreating] = useState(false)
  const [kbError, setKbError] = useState('')

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
      const patch: { voice_agent_id: string; prompt?: string; first_message?: string; voice_id?: string } = {
        voice_agent_id: id,
      }
      if (prompt !== config.prompt) patch.prompt = prompt
      if (firstMessage !== config.first_message) patch.first_message = firstMessage
      if (selectedVoice && selectedVoice !== config.voice_id) patch.voice_id = selectedVoice

      if (Object.keys(patch).length > 1) {
        await adminUpdateAgentConfig(patch)
      }

      if (kbChanged) {
        await adminUpdateAgentKb({
          voice_agent_id: id,
          knowledge_base: assignedKb,
          rag_enabled: ragEnabled,
        })
      }

      setSavedAt(Date.now())
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

  const currentVoiceName =
    voices.find((v) => v.voice_id === (selectedVoice || config?.voice_id))?.name ?? null

  return (
    <AppShell backTo="/admin/agents" backLabel="Zurück zu Agenten">
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : !agent ? (
        <div className="glass-card p-10 text-center text-sm text-red-700">Agent nicht gefunden.</div>
      ) : (
        <>
          {/* ============ HERO ============ */}
          <section className="relative overflow-hidden rounded-3xl glass-card-lg p-8">
            <div
              aria-hidden
              className="absolute -right-16 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <AgentAvatar />
                <div>
                  <p className="eyebrow mb-1.5">Voice-Agent</p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {agent.display_name ?? 'Unbenannter Agent'}
                  </h1>
                  <p className="mt-1 text-sm text-ink-muted">
                    {agent.customers?.name ? `für ${agent.customers.name}` : 'Kein Kunde verknüpft'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {agent.integrations && (
                      <span className="pill-neutral">
                        <PlugIcon /> {agent.integrations.name}
                        {agent.integrations.region ? ` · ${agent.integrations.region.toUpperCase()}` : ''}
                      </span>
                    )}
                    {agent.platform_phone_number_id && (
                      <span className="pill-brand">
                        <PhoneIcon /> Telefon verbunden
                      </span>
                    )}
                    {currentVoiceName && (
                      <span className="pill-neutral">
                        <SpeakerIcon /> {currentVoiceName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <AnimatePresence>
                  {savedAt && Date.now() - savedAt < 4000 && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="pill-success"
                    >
                      <CheckIcon /> Gespeichert
                    </motion.span>
                  )}
                </AnimatePresence>
                {hasUnsaved && (
                  <span className="pill-warn">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Ungesicherte Änderungen
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ============ TABS ============ */}
          <div className="mt-8 mb-5 flex justify-center">
            <div className="tab-pill-group">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`tab-pill ${tab === t.key ? 'tab-pill-active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
              >
                {tab === 'overview' && config && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard title="Sprache" value={config.language ?? '—'} icon={<GlobeIcon />} />
                    <InfoCard title="LLM-Modell" value={config.llm ?? '—'} icon={<CpuIcon />} />
                    <InfoCard title="TTS-Engine" value={config.tts_model ?? '—'} icon={<SpeakerIcon />} />
                    <InfoCard
                      title="Aktive Stimme"
                      value={currentVoiceName ?? 'Lade…'}
                      icon={<WaveIcon />}
                    />
                  </div>
                )}

                {tab === 'prompt' && (
                  <div className="space-y-4">
                    <div className="glass-card p-6">
                      <label className="label-soft mb-2 block">Begrüßung</label>
                      <textarea
                        value={firstMessage}
                        onChange={(e) => setFirstMessage(e.target.value)}
                        rows={2}
                        className="glass-input"
                        placeholder="Was der Agent als erstes sagt"
                      />
                    </div>
                    <div className="glass-card p-6">
                      <label className="label-soft mb-2 block">System-Prompt</label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={20}
                        className="glass-input font-mono text-xs leading-relaxed"
                        placeholder="Verhalten, Persönlichkeit, Regeln…"
                      />
                      <p className="mt-2 text-xs text-ink-muted">
                        Wird direkt an ElevenLabs gepatched. Tool-Definitionen bleiben unverändert.
                      </p>
                    </div>
                  </div>
                )}

                {tab === 'voice' && (
                  <div className="glass-card p-6">
                    {voicesLoading ? (
                      <div className="py-8 text-center text-sm text-ink-muted">Lade Stimmen…</div>
                    ) : voices.length === 0 ? (
                      <div className="py-8 text-center text-sm text-ink-muted">Keine Stimmen verfügbar.</div>
                    ) : (
                      <div className="scrollbar-thin max-h-[560px] space-y-2 overflow-y-auto pr-1">
                        {voices.map((v) => {
                          const active = selectedVoice === v.voice_id
                          return (
                            <label
                              key={v.voice_id}
                              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3.5 transition-all ${
                                active
                                  ? 'border border-brand-400/60 bg-brand-50/60 shadow-sm'
                                  : 'border border-white/40 bg-white/40 hover:bg-white/70'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                                    active ? 'bg-brand-400 text-white' : 'bg-white/70 text-brand-700'
                                  }`}
                                >
                                  <WaveIcon />
                                </div>
                                <div>
                                  <p className="text-sm font-medium tracking-tight">{v.name}</p>
                                  {Object.entries(v.labels).length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {Object.entries(v.labels)
                                        .slice(0, 3)
                                        .map(([k, val]) => (
                                          <span key={k} className="pill-neutral text-[10px]">
                                            {val}
                                          </span>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {v.preview_url && (
                                  <audio
                                    src={v.preview_url}
                                    controls
                                    preload="none"
                                    className="h-8 max-w-[180px]"
                                  />
                                )}
                                <input
                                  type="radio"
                                  name="voice"
                                  checked={active}
                                  onChange={() => setSelectedVoice(v.voice_id)}
                                  className="accent-brand-500"
                                />
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'kb' && (
                  <div className="space-y-4">
                    <div className="glass-card p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold tracking-tight">Wissensdatenbank</h3>
                          <p className="mt-1 text-sm text-ink-muted">
                            Dokumente, die der Agent über RAG durchsucht.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKbModalOpen(true)}
                          className="btn-primary text-sm"
                        >
                          <PlusIcon /> Dokument
                        </button>
                      </div>

                      <div className="mt-5 flex items-center justify-between rounded-xl bg-white/40 p-4">
                        <div>
                          <p className="text-sm font-medium">RAG aktiviert</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Agent sucht KB während des Gesprächs (etwas mehr Latenz, präzisere Antworten)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRagEnabled(!ragEnabled)}
                          className={`toggle ${ragEnabled ? 'toggle-on' : ''}`}
                        >
                          <span className="toggle-thumb" />
                        </button>
                      </div>
                    </div>

                    <div className="glass-card p-6">
                      <h4 className="label-soft mb-3">
                        Diesem Agent zugewiesen ({assignedKb.length})
                      </h4>
                      {assignedKb.length === 0 ? (
                        <p className="text-xs text-ink-muted">
                          Noch keine Dokumente zugewiesen. Unten aus dem Workspace adden oder neu erstellen.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {assignedKb.map((e) => (
                            <div
                              key={e.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/50 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <DocIcon />
                                <p className="text-sm font-medium">{e.name}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveKbFromAgent(e.id)}
                                className="text-xs font-medium text-red-600 hover:text-red-700"
                              >
                                Entfernen
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="glass-card p-6">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="label-soft">Verfügbar im Workspace</h4>
                        <button
                          type="button"
                          onClick={refreshWorkspaceKb}
                          className="btn-subtle text-xs"
                        >
                          Neu laden
                        </button>
                      </div>
                      {workspaceKbLoading ? (
                        <p className="text-xs text-ink-muted">Lade Workspace…</p>
                      ) : workspaceKb.length === 0 ? (
                        <p className="text-xs text-ink-muted">
                          Noch keine Dokumente im Workspace. Klick oben auf <strong>+ Dokument</strong>.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {workspaceKb.map((d) => {
                            const alreadyAssigned = assignedKb.some((e) => e.id === d.id)
                            return (
                              <div
                                key={d.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/40 p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <DocIcon />
                                  <p className="text-sm font-medium">{d.name}</p>
                                </div>
                                {alreadyAssigned ? (
                                  <span className="pill-success text-[11px]">
                                    <CheckIcon /> zugewiesen
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddKbToAgent(d)}
                                    className="btn-subtle text-xs"
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
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {saveError && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {/* Sticky save bar */}
            <div className="sticky bottom-4 z-10 flex justify-end pt-2">
              <AnimatePresence>
                {hasUnsaved && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    type="submit"
                    disabled={saving}
                    className="btn-primary px-6 shadow-glass-lg"
                  >
                    {saving ? 'Speichere…' : 'Änderungen speichern'}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </form>

          {/* ============ NEW KB MODAL ============ */}
          <AnimatePresence>
            {kbModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-md"
                onClick={() => setKbModalOpen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.97 }}
                  transition={{ duration: 0.22 }}
                  className="glass-card-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-xl font-semibold tracking-tight">
                    Neues <span className="heading-accent">Dokument</span>
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Wird im Workspace gespeichert und direkt diesem Agent zugewiesen.
                  </p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="label-soft mb-2 block">Name</label>
                      <input
                        type="text"
                        value={newKbName}
                        onChange={(e) => setNewKbName(e.target.value)}
                        placeholder="z.B. Preisliste 2026"
                        className="glass-input"
                      />
                    </div>
                    <div>
                      <label className="label-soft mb-2 block">Inhalt</label>
                      <textarea
                        value={newKbText}
                        onChange={(e) => setNewKbText(e.target.value)}
                        rows={14}
                        className="glass-input font-mono text-xs leading-relaxed"
                        placeholder="Vollständiger Text — wird über RAG durchsucht."
                      />
                    </div>
                    {kbError && (
                      <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
                        {kbError}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setKbModalOpen(false)}
                        className="btn-ghost flex-1"
                        disabled={kbCreating}
                      >
                        Abbrechen
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateNewKb}
                        disabled={kbCreating || !newKbName.trim() || !newKbText.trim()}
                        className="btn-primary flex-1"
                      >
                        {kbCreating ? 'Erstelle…' : 'Erstellen & Zuweisen'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AppShell>
  )
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-700"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--accent-400-rgb),0.2) 0%, rgba(var(--accent-400-rgb),0.12) 100%)',
            border: '1px solid rgba(var(--accent-400-rgb),0.25)',
          }}
        >
          {icon}
        </div>
        <div>
          <p className="label-soft">{title}</p>
          <p className="mt-0.5 text-sm font-semibold tracking-tight text-ink">{value}</p>
        </div>
      </div>
    </div>
  )
}

function AgentAvatar() {
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
      style={{
        background: 'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 8px 24px -8px rgba(var(--accent-shadow-rgb),0.55)',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1v6a4 4 0 0 1 0 8v2" />
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
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
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
function PlugIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7V2m6 5V2M5 13a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3z" />
    </svg>
  )
}
function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19 12a7 7 0 0 1-2 4.9" />
    </svg>
  )
}
function WaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2M23 12h-2" />
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" />
    </svg>
  )
}
function CpuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  )
}
function DocIcon() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-700"
      style={{
        background: 'linear-gradient(135deg, rgba(var(--accent-400-rgb),0.2) 0%, rgba(var(--accent-400-rgb),0.12) 100%)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    </div>
  )
}
