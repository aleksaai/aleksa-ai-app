// Customer-facing Voice-Agent-Detail page.
// Mirrors AgentDetail.tsx but with tabs filtered by customer_permissions
// (set by Admin in CustomerDetail.tsx) and a header back to /dashboard.

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
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

type AgentRow = VoiceAgent & {
  integrations: Pick<Integration, 'id' | 'name' | 'platform' | 'region'> | null
}

type Tab = 'overview' | 'prompt' | 'voice' | 'kb'

export function CustomerAgentDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, profile, signOut } = useAuth()

  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [perms, setPerms] = useState<CustomerPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  // Editable state
  const [prompt, setPrompt] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [voices, setVoices] = useState<Voice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)

  // KB
  const [workspaceKb, setWorkspaceKb] = useState<KBDoc[]>([])
  const [workspaceKbLoading, setWorkspaceKbLoading] = useState(false)
  const [assignedKb, setAssignedKb] = useState<KBEntry[]>([])
  const [ragEnabled, setRagEnabled] = useState(false)
  const [kbModalOpen, setKbModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [newKbText, setNewKbText] = useState('')
  const [kbCreating, setKbCreating] = useState(false)
  const [kbError, setKbError] = useState('')

  // Save
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!id || !profile?.customer_id) return
    ;(async () => {
      setLoading(true)

      // Permissions for this customer (read-only — admin sets these)
      const { data: p } = await supabase
        .from('customer_permissions')
        .select('*')
        .eq('customer_id', profile.customer_id)
        .maybeSingle()
      setPerms(p as CustomerPermissions | null)

      // Agent must belong to this customer (RLS enforces this)
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
        console.error('Failed to load agent config:', e)
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

  const canEditConfig = perms?.can_edit_agent_config ?? false
  const canEditKb = perms?.can_edit_kb ?? false

  // Available tabs based on permissions
  const availableTabs: Tab[] = ['overview']
  if (canEditConfig) availableTabs.push('prompt', 'voice')
  if (canEditKb) availableTabs.push('kb')

  // If current tab is no longer available (e.g. perm got revoked), fall back
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
        if (Object.keys(patch).length > 1) {
          await adminUpdateAgentConfig(patch)
        }
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Mein Voice-Agent</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={signOut} className="btn-ghost text-sm">Abmelden</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4">
          <Link to="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">← Zurück zum Dashboard</Link>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade…</div>
        ) : accessError ? (
          <div className="card text-center">
            <h2 className="text-lg font-semibold text-red-700">Kein Zugriff</h2>
            <p className="mt-1 text-sm text-slate-500">{accessError}</p>
          </div>
        ) : !agent ? (
          <div className="card text-center text-sm">Agent nicht gefunden.</div>
        ) : (
          <>
            <section className="card mb-6">
              <h1 className="text-2xl font-semibold">{agent.display_name ?? agent.platform_agent_id}</h1>
              {agent.integrations && (
                <p className="mt-1 text-sm text-slate-500">
                  {agent.integrations.platform}{agent.integrations.region ? ` · ${agent.integrations.region.toUpperCase()}` : ''}
                </p>
              )}
              {!canEditConfig && !canEditKb && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Du hast aktuell nur Lese-Zugriff auf diesen Agent. Wende dich an den Plattform-Admin
                  wenn du Editier-Rechte brauchst.
                </div>
              )}
            </section>

            <div className="mb-4 flex gap-1 border-b border-slate-200">
              {availableTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-600 hover:text-slate-900'
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
                  <Field label="Agent-ID" value={agent.platform_agent_id} mono />
                  {config && (
                    <>
                      <Field label="LLM-Modell" value={config.llm ?? '—'} />
                      <Field label="Sprache" value={config.language ?? '—'} />
                      <Field label="Aktuelle Voice" value={voices.find((v) => v.voice_id === config.voice_id)?.name ?? config.voice_id ?? '—'} />
                    </>
                  )}
                </motion.div>
              )}

              {tab === 'prompt' && canEditConfig && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Begrüßung</label>
                    <textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} rows={2} className="input" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">System-Prompt</label>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={20} className="input font-mono text-xs" />
                  </div>
                </motion.div>
              )}

              {tab === 'voice' && canEditConfig && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
                  {voicesLoading ? (
                    <div className="text-sm text-slate-500">Lade Voices…</div>
                  ) : voices.length === 0 ? (
                    <div className="text-sm text-slate-500">Keine Voices verfügbar.</div>
                  ) : (
                    <div className="max-h-[500px] space-y-2 overflow-y-auto">
                      {voices.map((v) => (
                        <label
                          key={v.voice_id}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                            selectedVoice === v.voice_id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input type="radio" name="voice" checked={selectedVoice === v.voice_id} onChange={() => setSelectedVoice(v.voice_id)} />
                            <div>
                              <div className="text-sm font-medium">{v.name}</div>
                              {Object.entries(v.labels).length > 0 && (
                                <div className="mt-1 flex gap-1">
                                  {Object.entries(v.labels).slice(0, 4).map(([k, val]) => (
                                    <span key={k} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{val}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {v.preview_url && <audio src={v.preview_url} controls preload="none" className="h-8 max-w-[180px]" />}
                        </label>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === 'kb' && canEditKb && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-semibold">Wissensdatenbank-Dokumente</h3>
                        <p className="mt-1 text-sm text-slate-500">Dokumente die dein Agent während des Gesprächs nutzen kann.</p>
                      </div>
                      <button type="button" onClick={() => setKbModalOpen(true)} className="btn-primary text-sm">+ Neuer Doc</button>
                    </div>
                    <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-medium">RAG aktiviert</p>
                        <p className="text-xs text-slate-500">Wenn an: Agent durchsucht Docs während des Gesprächs</p>
                      </div>
                      <input type="checkbox" checked={ragEnabled} onChange={(e) => setRagEnabled(e.target.checked)} className="h-5 w-5" />
                    </label>
                  </div>

                  <div className="card">
                    <h4 className="mb-3 text-sm font-medium">Zugewiesen ({assignedKb.length})</h4>
                    {assignedKb.length === 0 ? (
                      <p className="text-xs text-slate-500">Keine Docs zugewiesen.</p>
                    ) : (
                      <div className="space-y-2">
                        {assignedKb.map((e) => (
                          <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                            <p className="text-sm font-medium">{e.name}</p>
                            <button type="button" onClick={() => handleRemoveKbFromAgent(e.id)} className="btn-ghost text-xs text-red-600">Entfernen</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h4 className="mb-3 text-sm font-medium">Verfügbar</h4>
                    {workspaceKbLoading ? (
                      <p className="text-xs text-slate-500">Lade…</p>
                    ) : workspaceKb.length === 0 ? (
                      <p className="text-xs text-slate-500">Keine Docs verfügbar.</p>
                    ) : (
                      <div className="space-y-2">
                        {workspaceKb.map((d) => {
                          const already = assignedKb.some((e) => e.id === d.id)
                          return (
                            <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                              <div>
                                <p className="text-sm font-medium">{d.name}</p>
                                <p className="font-mono text-xs text-slate-500">{d.type}</p>
                              </div>
                              {already ? (
                                <span className="text-xs text-emerald-600">✓ zugewiesen</span>
                              ) : (
                                <button type="button" onClick={() => handleAddKbToAgent(d)} className="btn-ghost text-xs">+ Zuweisen</button>
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
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
              )}

              {(canEditConfig || canEditKb) && (
                <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3">
                  {savedAt && Date.now() - savedAt < 4000 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">✓ Gespeichert</span>
                  )}
                  <button type="submit" disabled={saving || !hasUnsaved} className="btn-primary shadow-lg">
                    {saving ? 'Speichere…' : hasUnsaved ? 'Änderungen speichern' : 'Keine Änderungen'}
                  </button>
                </div>
              )}
            </form>

            {kbModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setKbModalOpen(false)}>
                <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-xl font-semibold">Neuen KB-Doc erstellen</h2>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                      <input type="text" value={newKbName} onChange={(e) => setNewKbName(e.target.value)} className="input" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Inhalt</label>
                      <textarea value={newKbText} onChange={(e) => setNewKbText(e.target.value)} rows={15} className="input font-mono text-xs" />
                    </div>
                    {kbError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{kbError}</div>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setKbModalOpen(false)} className="btn-ghost flex-1" disabled={kbCreating}>Abbrechen</button>
                      <button type="button" onClick={handleCreateNewKb} disabled={kbCreating || !newKbName.trim() || !newKbText.trim()} className="btn-primary flex-1">
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
