import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { VoiceAgent, Integration, CustomerPermissions } from '../types/db'
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
import { CustomerShell } from '../components/CustomerShell'

type AgentRow = VoiceAgent & {
  integrations: Pick<Integration, 'id' | 'name' | 'platform' | 'region'> | null
}

type Tab = 'overview' | 'prompt' | 'voice' | 'kb'

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Übersicht',
  prompt: 'Prompt',
  voice: 'Stimme',
  kb: 'Wissen',
}

export function CustomerAgentDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()

  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [perms, setPerms] = useState<CustomerPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
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
    if (!id || !profile?.customer_id) return
    ;(async () => {
      setLoading(true)
      const { data: p } = await supabase
        .from('customer_permissions')
        .select('*')
        .eq('customer_id', profile.customer_id)
        .maybeSingle()
      setPerms(p as CustomerPermissions | null)

      const { data: a } = await supabase
        .from('voice_agents')
        .select('*, integrations(id, name, platform, region)')
        .eq('id', id)
        .maybeSingle()

      if (!a) {
        setAccessError('Agent nicht gefunden oder kein Zugriff.')
        setLoading(false)
        return
      }
      setAgent(a as AgentRow)

      try {
        const cfg = await adminGetAgentConfig(id)
        setConfig(cfg)
        setPrompt(cfg.prompt)
        setFirstMessage(cfg.first_message)
        setSelectedVoice(cfg.voice_id ?? '')
        setAssignedKb(cfg.knowledge_base ?? [])
        setRagEnabled(cfg.rag_enabled ?? false)
      } catch (e) {
        setAccessError(e instanceof Error ? e.message : String(e))
      }
      setLoading(false)
    })()
  }, [id, profile?.customer_id])

  useEffect(() => {
    if (tab !== 'voice' || !agent?.integrations?.id || voices.length > 0) return
    setVoicesLoading(true)
    adminListVoices(agent.integrations.id)
      .then((vs) => setVoices(vs))
      .catch(() => undefined)
      .finally(() => setVoicesLoading(false))
  }, [tab, agent, voices.length])

  useEffect(() => {
    if (tab !== 'kb' || !agent?.integrations?.id || workspaceKb.length > 0) return
    setWorkspaceKbLoading(true)
    adminListKbDocs(agent.integrations.id)
      .then((docs) => setWorkspaceKb(docs))
      .catch(() => undefined)
      .finally(() => setWorkspaceKbLoading(false))
  }, [tab, agent, workspaceKb.length])

  const canEditConfig = perms?.can_edit_agent_config ?? false
  const canEditKb = perms?.can_edit_kb ?? false

  const availableTabs: Tab[] = ['overview']
  if (canEditConfig) availableTabs.push('prompt', 'voice')
  if (canEditKb) availableTabs.push('kb')

  useEffect(() => {
    if (!availableTabs.includes(tab)) setTab('overview')
  }, [perms]) // eslint-disable-line

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

  const configChanged =
    config !== null &&
    (prompt !== config.prompt ||
      firstMessage !== config.first_message ||
      (selectedVoice !== '' && selectedVoice !== config.voice_id))

  const hasUnsaved = configChanged || kbChanged

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !config) return
    setSaving(true)
    setSaveError('')

    try {
      if (canEditConfig && configChanged) {
        const patch: { voice_agent_id: string; prompt?: string; first_message?: string; voice_id?: string } = {
          voice_agent_id: id,
        }
        if (prompt !== config.prompt) patch.prompt = prompt
        if (firstMessage !== config.first_message) patch.first_message = firstMessage
        if (selectedVoice && selectedVoice !== config.voice_id) patch.voice_id = selectedVoice
        if (Object.keys(patch).length > 1) await adminUpdateAgentConfig(patch)
      }
      if (canEditKb && kbChanged) {
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

  const currentVoiceName =
    voices.find((v) => v.voice_id === (selectedVoice || config?.voice_id))?.name ?? null

  return (
    <CustomerShell backTo="/dashboard" backLabel="Zurück zum Dashboard">
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : accessError ? (
        <div className="glass-card-lg mx-auto max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold text-red-700">Kein Zugriff</h2>
          <p className="mt-2 text-sm text-ink-muted">{accessError}</p>
        </div>
      ) : !agent ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Agent nicht gefunden.</div>
      ) : (
        <>
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl glass-card-lg p-8">
            <div
              aria-hidden
              className="absolute -right-16 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <AgentAvatar />
                <div>
                  <p className="eyebrow mb-1.5">Voice-Agent</p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    {agent.display_name ?? 'Mein Agent'}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {agent.integrations && (
                      <span className="pill-neutral">
                        {agent.integrations.platform}
                        {agent.integrations.region ? ` · ${agent.integrations.region.toUpperCase()}` : ''}
                      </span>
                    )}
                    {currentVoiceName && (
                      <span className="pill-neutral">
                        <WaveIcon /> {currentVoiceName}
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

            {!canEditConfig && !canEditKb && (
              <div className="mt-5 rounded-xl border border-amber-200/50 bg-amber-50/60 p-3 text-xs text-amber-800">
                Du hast aktuell nur Lese-Zugriff auf diesen Agent. Wende dich an den Plattform-Admin, wenn du Editier-Rechte brauchst.
              </div>
            )}
          </section>

          {/* Tabs */}
          {availableTabs.length > 1 && (
            <div className="mt-8 mb-5 flex justify-center">
              <div className="tab-pill-group">
                {availableTabs.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`tab-pill ${tab === t ? 'tab-pill-active' : ''}`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                    <InfoCard title="Aktive Stimme" value={currentVoiceName ?? 'Lade…'} icon={<WaveIcon />} />
                  </div>
                )}

                {tab === 'prompt' && canEditConfig && (
                  <div className="space-y-4">
                    <div className="glass-card p-6">
                      <label className="label-soft mb-2 block">Begrüßung</label>
                      <textarea
                        value={firstMessage}
                        onChange={(e) => setFirstMessage(e.target.value)}
                        rows={2}
                        className="glass-input"
                      />
                    </div>
                    <div className="glass-card p-6">
                      <label className="label-soft mb-2 block">System-Prompt</label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={20}
                        className="glass-input font-mono text-xs leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {tab === 'voice' && canEditConfig && (
                  <div className="glass-card p-6">
                    {voicesLoading ? (
                      <div className="py-8 text-center text-sm text-ink-muted">Lade Stimmen…</div>
                    ) : voices.length === 0 ? (
                      <div className="py-8 text-center text-sm text-ink-muted">
                        Keine Stimmen verfügbar.
                      </div>
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
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
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

                {tab === 'kb' && canEditKb && (
                  <div className="space-y-4">
                    <div className="glass-card p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold tracking-tight">Wissensdatenbank</h3>
                          <p className="mt-1 text-sm text-ink-muted">
                            Dokumente, die dein Agent während des Gesprächs nutzen kann.
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
                            Wenn an: Agent sucht Docs während des Gesprächs.
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
                      <h4 className="label-soft mb-3">Zugewiesen ({assignedKb.length})</h4>
                      {assignedKb.length === 0 ? (
                        <p className="text-xs text-ink-muted">Noch keine Dokumente zugewiesen.</p>
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
                      <h4 className="label-soft mb-3">Verfügbar</h4>
                      {workspaceKbLoading ? (
                        <p className="text-xs text-ink-muted">Lade…</p>
                      ) : workspaceKb.length === 0 ? (
                        <p className="text-xs text-ink-muted">Keine Dokumente verfügbar.</p>
                      ) : (
                        <div className="space-y-2">
                          {workspaceKb.map((d) => {
                            const already = assignedKb.some((e) => e.id === d.id)
                            return (
                              <div
                                key={d.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/40 p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <DocIcon />
                                  <p className="text-sm font-medium">{d.name}</p>
                                </div>
                                {already ? (
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

            {(canEditConfig || canEditKb) && (
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
            )}
          </form>

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
                  className="glass-card-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 className="text-xl font-semibold tracking-tight">
                    Neues <span className="heading-accent">Dokument</span>
                  </h2>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="label-soft mb-2 block">Name</label>
                      <input
                        type="text"
                        value={newKbName}
                        onChange={(e) => setNewKbName(e.target.value)}
                        className="glass-input"
                      />
                    </div>
                    <div>
                      <label className="label-soft mb-2 block">Inhalt</label>
                      <textarea
                        value={newKbText}
                        onChange={(e) => setNewKbText(e.target.value)}
                        rows={14}
                        className="glass-input font-mono text-xs"
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
    </CustomerShell>
  )
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background:
              'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.12) 100%)',
            border: '1px solid rgba(var(--accent-400-rgb), 0.25)',
            color: 'var(--accent-700)',
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
        background:
          'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 8px 24px -8px rgba(var(--accent-shadow-rgb),0.55)',
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
function WaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
function DocIcon() {
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{
        background:
          'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.12) 100%)',
        color: 'var(--accent-700)',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    </div>
  )
}
