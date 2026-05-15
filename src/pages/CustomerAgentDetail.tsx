import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type {
  VoiceAgent,
  Integration,
  Customer,
  PricingPlan,
  CustomerPermissions,
} from '../types/db'
import {
  adminGetAgentConfig,
  adminUpdateAgentConfig,
  adminListVoices,
  adminListKbDocs,
  adminCreateKbDoc,
  adminUpdateAgentKb,
  getCustomerBillingPortalUrl,
  type AgentConfig,
  type Voice,
  type KBDoc,
  type KBEntry,
} from '../lib/api'
import {
  formatMoney,
  formatDuration,
  costPerMinuteLabel,
} from '../lib/billing'
import { AgentShell, type AgentSection } from '../components/AgentShell'
import { MiniLineChart } from '../components/MiniLineChart'

type AgentRow = VoiceAgent & {
  customers: Pick<Customer, 'id' | 'name'> | null
  integrations: Pick<Integration, 'id' | 'name' | 'platform' | 'region'> | null
  pricing_plans: PricingPlan | null
  customer_subscriptions: {
    id: string
    status: string
    current_period_start: string | null
    current_period_end: string | null
  }[]
}

type CallRow = {
  id: string
  duration_secs: number
  started_at: string
  termination_reason: string | null
}

type Range = 7 | 14 | 30

type Props = {
  isAdminPreview?: boolean
  agentIdOverride?: string
}

export function CustomerAgentDetail({ isAdminPreview, agentIdOverride }: Props = {}) {
  const params = useParams<{ id: string }>()
  const id = agentIdOverride ?? params.id
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [perms, setPerms] = useState<CustomerPermissions | null>(null)
  const [calls, setCalls] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('analytics')
  const [range, setRange] = useState<Range>(7)
  const [refreshedAt, setRefreshedAt] = useState(new Date())

  // Editable state for Konfiguration
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

  // Save state
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')

  // Billing portal
  const [portalLoading, setPortalLoading] = useState(false)

  const loadAll = async () => {
    if (!id) {
      setLoading(false)
      return
    }
    if (!profile?.customer_id && !isAdminPreview) {
      // Admin hitting /dashboard/agents/:id directly — no customer context
      setAccessError('Kein Zugriff für diese Ansicht.')
      setLoading(false)
      return
    }
    setLoading(true)
    const { data: a } = await supabase
      .from('voice_agents')
      .select(
        `*, customers(id, name), integrations(id, name, platform, region), pricing_plans(*),
        customer_subscriptions(id, status, current_period_start, current_period_end)`,
      )
      .eq('id', id)
      .maybeSingle()

    if (!a) {
      setAccessError('Agent nicht gefunden oder kein Zugriff.')
      setLoading(false)
      return
    }
    setAgent(a as AgentRow)

    // Load calls for analytics (last 60 days covers all ranges + prior periods)
    const since = new Date()
    since.setDate(since.getDate() - 60)
    const { data: cs } = await supabase
      .from('calls')
      .select('id, duration_secs, started_at, termination_reason')
      .eq('voice_agent_id', id)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false })
    setCalls((cs ?? []) as CallRow[])

    // Permissions (only matters for non-admin)
    if (profile?.customer_id) {
      const { data: p } = await supabase
        .from('customer_permissions')
        .select('*')
        .eq('customer_id', profile.customer_id)
        .maybeSingle()
      setPerms(p as CustomerPermissions | null)
    } else if (isAdminPreview && (a as AgentRow).customers?.id) {
      // Admin viewing customer: load that customer's perms so we know what's gated
      const { data: p } = await supabase
        .from('customer_permissions')
        .select('*')
        .eq('customer_id', (a as AgentRow).customers!.id)
        .maybeSingle()
      setPerms(p as CustomerPermissions | null)
    }

    try {
      const cfg = await adminGetAgentConfig(id)
      setConfig(cfg)
      setPrompt(cfg.prompt)
      setFirstMessage(cfg.first_message)
      setSelectedVoice(cfg.voice_id ?? '')
      setAssignedKb(cfg.knowledge_base ?? [])
      setRagEnabled(cfg.rag_enabled ?? false)
    } catch (e) {
      // Config-load failure is non-fatal for analytics/calls
      console.error('Failed to load agent config:', e)
    }
    setRefreshedAt(new Date())
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profile?.customer_id])

  // Lazy-load voices and KB when their sections open
  useEffect(() => {
    if (activeSection !== 'config' || !agent?.integrations?.id || voices.length > 0) return
    setVoicesLoading(true)
    adminListVoices(agent.integrations.id)
      .then(setVoices)
      .catch(() => undefined)
      .finally(() => setVoicesLoading(false))
  }, [activeSection, agent, voices.length])

  useEffect(() => {
    if (activeSection !== 'kb' || !agent?.integrations?.id || workspaceKb.length > 0) return
    setWorkspaceKbLoading(true)
    adminListKbDocs(agent.integrations.id)
      .then(setWorkspaceKb)
      .catch(() => undefined)
      .finally(() => setWorkspaceKbLoading(false))
  }, [activeSection, agent, workspaceKb.length])

  // Permissions
  const isAdmin = profile?.role === 'admin' || isAdminPreview
  const canEditConfig = isAdmin || (perms?.can_edit_agent_config ?? false)
  const canEditKb = isAdmin || (perms?.can_edit_kb ?? false)
  const canViewCalls = isAdmin || (perms?.can_view_calls ?? false)

  // ============ ANALYTICS ============
  const analytics = useMemo(() => {
    return computeAnalytics(calls, range)
  }, [calls, range])

  // ============ SECTIONS ============
  const sections: AgentSection[] = useMemo(() => {
    const list: AgentSection[] = [
      { key: 'analytics', label: 'Analytik', icon: <AnalyticsIcon /> },
    ]
    if (canViewCalls) list.push({ key: 'calls', label: 'Gespräche', icon: <CallsIcon /> })
    if (canEditConfig) list.push({ key: 'config', label: 'Konfiguration', icon: <ConfigIcon /> })
    if (canEditKb) list.push({ key: 'kb', label: 'Wissensbasis', icon: <KbIcon /> })
    list.push({ key: 'billing', label: 'Abonnementdetails', icon: <BillingIcon /> })
    return list
  }, [canViewCalls, canEditConfig, canEditKb])

  // If active section no longer accessible, fall back
  useEffect(() => {
    if (!sections.find((s) => s.key === activeSection)) {
      setActiveSection('analytics')
    }
  }, [sections, activeSection])

  // ============ SAVE HANDLERS (config + kb) ============
  const configChanged =
    config !== null &&
    (prompt !== config.prompt ||
      firstMessage !== config.first_message ||
      (selectedVoice !== '' && selectedVoice !== config.voice_id))

  const kbChanged =
    config !== null &&
    (JSON.stringify(assignedKb.map((e) => e.id).sort()) !==
      JSON.stringify((config.knowledge_base ?? []).map((e) => e.id).sort()) ||
      ragEnabled !== config.rag_enabled)

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

  const handleAddKb = (doc: KBDoc) => {
    if (assignedKb.find((e) => e.id === doc.id)) return
    setAssignedKb([
      ...assignedKb,
      { id: doc.id, name: doc.name, type: (doc.type as KBEntry['type']) ?? 'text', usage_mode: 'auto' },
    ])
  }
  const handleRemoveKb = (docId: string) => setAssignedKb(assignedKb.filter((e) => e.id !== docId))

  const handleCreateKb = async () => {
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
      setAssignedKb([...assignedKb, { id: doc.id, name: doc.name, type: 'text', usage_mode: 'auto' }])
      setKbModalOpen(false)
      setNewKbName('')
      setNewKbText('')
    } catch (e) {
      setKbError(e instanceof Error ? e.message : String(e))
    } finally {
      setKbCreating(false)
    }
  }

  const handleOpenBillingPortal = async () => {
    if (isAdminPreview) {
      alert('Im Admin-Preview-Modus nicht verfügbar — nur der Kunde selbst kann das Stripe-Portal öffnen.')
      return
    }
    setPortalLoading(true)
    try {
      const url = await getCustomerBillingPortalUrl()
      window.location.href = url
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setPortalLoading(false)
    }
  }

  const backTo = isAdminPreview && agent?.customers
    ? `/admin/customers/${agent.customers.id}/view`
    : '/dashboard'
  const customerName = isAdminPreview ? agent?.customers?.name : undefined

  if (loading) {
    return (
      <AgentShell
        sections={[{ key: 'analytics', label: 'Analytik', icon: <AnalyticsIcon /> }]}
        activeKey="analytics"
        onChangeSection={() => undefined}
        backTo={backTo}
        backLabel="Zurück zu Agenten"
        customerName={customerName}
        adminPreview={isAdminPreview}
        onExitPreview={() => navigate(backTo)}
      >
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      </AgentShell>
    )
  }

  if (accessError || !agent) {
    return (
      <AgentShell
        sections={[{ key: 'analytics', label: 'Analytik', icon: <AnalyticsIcon /> }]}
        activeKey="analytics"
        onChangeSection={() => undefined}
        backTo={backTo}
        backLabel="Zurück zu Agenten"
        customerName={customerName}
        adminPreview={isAdminPreview}
        onExitPreview={() => navigate(backTo)}
      >
        <div className="glass-card-lg mx-auto max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold text-red-700">Kein Zugriff</h2>
          <p className="mt-2 text-sm text-ink-muted">{accessError ?? 'Agent nicht gefunden.'}</p>
        </div>
      </AgentShell>
    )
  }

  const sectionLabel = sections.find((s) => s.key === activeSection)?.label ?? ''

  return (
    <AgentShell
      sections={sections}
      activeKey={activeSection}
      onChangeSection={setActiveSection}
      backTo={backTo}
      backLabel="Zurück zu Agenten"
      customerName={customerName ?? agent.display_name ?? 'Agent'}
      adminPreview={isAdminPreview}
      onExitPreview={() => navigate(backTo)}
      pageTitle={sectionLabel}
      pageAction={
        activeSection === 'analytics' ? (
          <RangePicker value={range} onChange={setRange} />
        ) : undefined
      }
      lastUpdated={
        activeSection === 'analytics'
          ? `${refreshedAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}, ${refreshedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
          : undefined
      }
    >
      {activeSection === 'analytics' && (
        <AnalyticsView analytics={analytics} onRefresh={loadAll} />
      )}

      {activeSection === 'calls' && (
        <CallsView
          calls={calls}
          onOpen={(callId) =>
            navigate(isAdminPreview ? `/admin/calls/${callId}` : `/dashboard/calls/${callId}`)
          }
        />
      )}

      {activeSection === 'config' && canEditConfig && (
        <form onSubmit={handleSave} className="space-y-4">
          <ConfigView
            firstMessage={firstMessage}
            onFirstMessageChange={setFirstMessage}
            prompt={prompt}
            onPromptChange={setPrompt}
            voices={voices}
            voicesLoading={voicesLoading}
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            currentVoiceId={config?.voice_id ?? null}
            language={config?.language ?? null}
          />
          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <StickySaveBar
            hasUnsaved={hasUnsaved}
            saving={saving}
            savedAt={savedAt}
          />
        </form>
      )}

      {activeSection === 'kb' && canEditKb && (
        <form onSubmit={handleSave} className="space-y-4">
          <KbView
            assignedKb={assignedKb}
            workspaceKb={workspaceKb}
            workspaceLoading={workspaceKbLoading}
            ragEnabled={ragEnabled}
            onToggleRag={() => setRagEnabled(!ragEnabled)}
            onAdd={handleAddKb}
            onRemove={handleRemoveKb}
            onOpenModal={() => setKbModalOpen(true)}
          />
          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <StickySaveBar hasUnsaved={hasUnsaved} saving={saving} savedAt={savedAt} />
        </form>
      )}

      {activeSection === 'billing' && (
        <BillingView
          agent={agent}
          onOpenPortal={handleOpenBillingPortal}
          portalLoading={portalLoading}
          isAdminPreview={isAdminPreview}
        />
      )}

      {/* New KB modal */}
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
                    onClick={handleCreateKb}
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
    </AgentShell>
  )
}

// ============================================================
// ANALYTICS HELPERS
// ============================================================

type AnalyticsResult = {
  labels: string[]
  currentMinutes: number[]
  previousMinutes: number[]
  currentCounts: number[]
  previousCounts: number[]
  totalMinutesSecs: number
  totalCount: number
  prevTotalMinutesSecs: number
  prevTotalCount: number
  minutesDeltaPct: number | null
  countDeltaPct: number | null
}

function computeAnalytics(calls: CallRow[], range: Range): AnalyticsResult {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // Build buckets: current period = [today - (range-1)d, today], previous = [today - (2*range-1)d, today - range*d]
  const buildBuckets = (offsetDays: number) => {
    const minutesBuckets = new Array(range).fill(0)
    const countBuckets = new Array(range).fill(0)
    for (const c of calls) {
      const t = new Date(c.started_at).getTime()
      const dayStart = new Date(c.started_at)
      const dayStartMs = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate()).getTime()
      const dayDiff = Math.floor((today - dayStartMs) / dayMs) - offsetDays
      if (dayDiff >= 0 && dayDiff < range) {
        const idx = range - 1 - dayDiff
        minutesBuckets[idx] += c.duration_secs
        countBuckets[idx] += 1
      }
      // satisfy linter on unused t
      void t
    }
    return { minutesBuckets, countBuckets }
  }

  const current = buildBuckets(0)
  const previous = buildBuckets(range)

  const labels: string[] = []
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today - i * dayMs)
    labels.push(d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }))
  }

  const totalMinutesSecs = current.minutesBuckets.reduce((a, b) => a + b, 0)
  const totalCount = current.countBuckets.reduce((a, b) => a + b, 0)
  const prevTotalMinutesSecs = previous.minutesBuckets.reduce((a, b) => a + b, 0)
  const prevTotalCount = previous.countBuckets.reduce((a, b) => a + b, 0)

  const pctDelta = (curr: number, prev: number): number | null => {
    if (prev === 0) {
      return curr === 0 ? 0 : null // null = "neu", no comparison possible
    }
    return ((curr - prev) / prev) * 100
  }

  return {
    labels,
    currentMinutes: current.minutesBuckets.map((s) => s / 60),
    previousMinutes: previous.minutesBuckets.map((s) => s / 60),
    currentCounts: current.countBuckets,
    previousCounts: previous.countBuckets,
    totalMinutesSecs,
    totalCount,
    prevTotalMinutesSecs,
    prevTotalCount,
    minutesDeltaPct: pctDelta(totalMinutesSecs, prevTotalMinutesSecs),
    countDeltaPct: pctDelta(totalCount, prevTotalCount),
  }
}

// ============================================================
// SECTION VIEWS
// ============================================================

function AnalyticsView({
  analytics,
  onRefresh,
}: {
  analytics: AnalyticsResult
  onRefresh: () => void
}) {
  return (
    <>
      <div className="mb-6 flex justify-end">
        <button onClick={onRefresh} className="btn-subtle text-xs">
          <RefreshIcon /> Aktualisieren
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiTile
          label="Gesamtgesprächsminuten"
          value={formatDuration(analytics.totalMinutesSecs)}
          deltaPct={analytics.minutesDeltaPct}
        />
        <KpiTile
          label="Anzahl der Anrufe"
          value={analytics.totalCount.toString()}
          deltaPct={analytics.countDeltaPct}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Gesamtgesprächsminuten"
          subtitle="Die täglich für Anrufe aufgewendeten Minuten"
          deltaPct={analytics.minutesDeltaPct}
        >
          <MiniLineChart
            current={analytics.currentMinutes}
            previous={analytics.previousMinutes}
            labels={analytics.labels}
            formatY={(v) =>
              v === 0 ? '0' : v >= 60 ? `${Math.round(v / 60)}h` : `${v.toFixed(0)}m`
            }
            currentColor="#10b981"
            previousColor="#fb7185"
          />
        </ChartCard>

        <ChartCard
          title="Anzahl der Anrufe"
          subtitle="Die täglich getätigten Anrufe"
          deltaPct={analytics.countDeltaPct}
        >
          <MiniLineChart
            current={analytics.currentCounts}
            previous={analytics.previousCounts}
            labels={analytics.labels}
            formatY={(v) => v.toFixed(0)}
            currentColor="#f59e0b"
            previousColor="#10b981"
          />
        </ChartCard>
      </div>
    </>
  )
}

function CallsView({
  calls,
  onOpen,
}: {
  calls: CallRow[]
  onOpen: (id: string) => void
}) {
  if (calls.length === 0) {
    return (
      <div className="glass-card p-10 text-center text-sm text-ink-muted">
        Noch keine Anrufe.
      </div>
    )
  }
  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-white/40 px-5 py-3 text-xs font-medium text-ink-muted">
        Letzte {calls.length} {calls.length === 1 ? 'Anruf' : 'Anrufe'}
      </div>
      <div className="divide-y divide-white/40">
        {calls.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/40"
          >
            <div className="flex min-w-0 items-center gap-3">
              <CallIconBadge />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {new Date(c.started_at).toLocaleString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Dauer {formatDuration(c.duration_secs)}
                  {c.termination_reason && <span> · Ende: {c.termination_reason}</span>}
                </p>
              </div>
            </div>
            <span
              className="text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'var(--accent-700)' }}
            >
              Details →
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ConfigView({
  firstMessage,
  onFirstMessageChange,
  prompt,
  onPromptChange,
  voices,
  voicesLoading,
  selectedVoice,
  onVoiceChange,
  currentVoiceId,
  language,
}: {
  firstMessage: string
  onFirstMessageChange: (v: string) => void
  prompt: string
  onPromptChange: (v: string) => void
  voices: Voice[]
  voicesLoading: boolean
  selectedVoice: string
  onVoiceChange: (id: string) => void
  currentVoiceId: string | null
  language: string | null
}) {
  return (
    <div className="space-y-4">
      {language && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill-neutral">
            <GlobeIcon /> {language}
          </span>
        </div>
      )}

      <div className="glass-card p-6">
        <label className="label-soft mb-2 block">Begrüßung</label>
        <textarea
          value={firstMessage}
          onChange={(e) => onFirstMessageChange(e.target.value)}
          rows={2}
          className="glass-input"
        />
      </div>

      <div className="glass-card p-6">
        <label className="label-soft mb-2 block">System-Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={18}
          className="glass-input font-mono text-xs leading-relaxed"
        />
      </div>

      <div className="glass-card p-6">
        <label className="label-soft mb-3 block">Stimme</label>
        {voicesLoading ? (
          <p className="py-4 text-center text-sm text-ink-muted">Lade Stimmen…</p>
        ) : voices.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Keine Stimmen verfügbar.</p>
        ) : (
          <div className="scrollbar-thin max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {voices.map((v) => {
              const active = (selectedVoice || currentVoiceId) === v.voice_id
              return (
                <label
                  key={v.voice_id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3 transition-all ${
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
                      <audio src={v.preview_url} controls preload="none" className="h-8 max-w-[180px]" />
                    )}
                    <input
                      type="radio"
                      name="voice"
                      checked={active}
                      onChange={() => onVoiceChange(v.voice_id)}
                      className="accent-brand-500"
                    />
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function KbView({
  assignedKb,
  workspaceKb,
  workspaceLoading,
  ragEnabled,
  onToggleRag,
  onAdd,
  onRemove,
  onOpenModal,
}: {
  assignedKb: KBEntry[]
  workspaceKb: KBDoc[]
  workspaceLoading: boolean
  ragEnabled: boolean
  onToggleRag: () => void
  onAdd: (doc: KBDoc) => void
  onRemove: (id: string) => void
  onOpenModal: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-semibold tracking-tight">Wissensbasis</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Dokumente, die der Agent während des Gesprächs durchsucht.
            </p>
          </div>
          <button type="button" onClick={onOpenModal} className="btn-primary text-sm">
            <PlusIcon /> Dokument
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl bg-white/40 p-4">
          <div>
            <p className="text-sm font-medium">RAG aktiviert</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Wenn an: Agent sucht KB-Dokumente während des Gesprächs.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleRag}
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
                  <DocBadge />
                  <p className="text-sm font-medium">{e.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
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
        <h4 className="label-soft mb-3">Verfügbar im Workspace</h4>
        {workspaceLoading ? (
          <p className="text-xs text-ink-muted">Lade…</p>
        ) : workspaceKb.length === 0 ? (
          <p className="text-xs text-ink-muted">Keine Dokumente im Workspace.</p>
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
                    <DocBadge />
                    <p className="text-sm font-medium">{d.name}</p>
                  </div>
                  {already ? (
                    <span className="pill-success text-[11px]">
                      <CheckIcon /> zugewiesen
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(d)}
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
  )
}

function BillingView({
  agent,
  onOpenPortal,
  portalLoading,
  isAdminPreview,
}: {
  agent: AgentRow
  onOpenPortal: () => void
  portalLoading: boolean
  isAdminPreview?: boolean
}) {
  const plan = agent.pricing_plans
  const sub = agent.customer_subscriptions?.[0]
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl glass-card-lg p-7">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
        />
        <div className="relative">
          <p className="eyebrow mb-1.5">Aktueller Plan</p>
          {plan ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{costPerMinuteLabel(plan)}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <InfoRow label="Typ" value={planTypeLabel(plan.type)} />
                <InfoRow label="Währung" value={plan.currency} />
                {plan.flat_amount_cents != null && (
                  <InfoRow
                    label="Grundgebühr"
                    value={`${formatMoney(plan.flat_amount_cents, plan.currency)}${
                      plan.billing_interval === 'year' ? ' / Jahr' : plan.billing_interval === 'month' ? ' / Monat' : ''
                    }`}
                  />
                )}
                {plan.included_minutes != null && plan.included_minutes > 0 && (
                  <InfoRow label="Inkludiert" value={`${plan.included_minutes} Minuten`} />
                )}
                {plan.per_minute_overage_cents != null && (
                  <InfoRow
                    label="Pro Minute"
                    value={`${plan.per_minute_overage_cents} ct`}
                  />
                )}
                {sub && (
                  <InfoRow
                    label="Status"
                    value={sub.status === 'active' ? 'Aktiv' : sub.status}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-ink-muted">
                Noch kein Plan
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Für diesen Agent ist noch kein Pricing-Paket aktiv. Wende dich an deinen Ansprechpartner.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold tracking-tight">Rechnungen & Zahlungsmethode</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Verwalte deine Zahlungsdaten, lade Belege herunter oder ändere deine Karte.
            </p>
          </div>
          <button
            onClick={onOpenPortal}
            disabled={portalLoading || isAdminPreview}
            className="btn-primary shrink-0"
            title={isAdminPreview ? 'Im Admin-Preview deaktiviert' : ''}
          >
            {portalLoading ? 'Lade…' : 'Stripe-Portal öffnen →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SMALL COMPONENTS
// ============================================================

function KpiTile({
  label,
  value,
  deltaPct,
}: {
  label: string
  value: string
  deltaPct: number | null
}) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{label}</p>
        <DeltaPill pct={deltaPct} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  deltaPct,
  children,
}: {
  title: string
  subtitle: string
  deltaPct: number | null
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold tracking-tight text-ink">{title}</h4>
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        </div>
        <DeltaPill pct={deltaPct} />
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function DeltaPill({ pct }: { pct: number | null }) {
  if (pct === null)
    return <span className="pill-neutral text-[11px]">neu</span>
  const positive = pct > 0
  const negative = pct < 0
  return (
    <span
      className={
        positive
          ? 'pill-success text-[11px]'
          : negative
          ? 'pill text-[11px] !bg-red-100/70 !text-red-700 !border-red-200/60'
          : 'pill-neutral text-[11px]'
      }
    >
      {positive ? '↑' : negative ? '↓' : '·'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function RangePicker({ value, onChange }: { value: Range; onChange: (v: Range) => void }) {
  const options: { v: Range; label: string }[] = [
    { v: 7, label: 'Letzte 7 Tage' },
    { v: 14, label: 'Letzte 14 Tage' },
    { v: 30, label: 'Letzte 30 Tage' },
  ]
  return (
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) as Range)}
      className="glass-input cursor-pointer py-2 pr-9 text-sm"
      style={{ width: 'auto', minWidth: '160px' }}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function StickySaveBar({
  hasUnsaved,
  saving,
  savedAt,
}: {
  hasUnsaved: boolean
  saving: boolean
  savedAt: number | null
}) {
  return (
    <div className="sticky bottom-4 z-10 flex justify-end gap-2 pt-2">
      <AnimatePresence>
        {savedAt && Date.now() - savedAt < 4000 && (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pill-success self-center"
          >
            <CheckIcon /> Gespeichert
          </motion.span>
        )}
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
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/40 p-3">
      <p className="label-soft">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  )
}

function planTypeLabel(t: string): string {
  switch (t) {
    case 'hybrid':
      return 'Grundabo + Nutzung'
    case 'per_minute':
      return 'Pro Minute'
    case 'one_time':
      return 'Einmalig'
    case 'flat':
      return 'Flat Abo'
    default:
      return t
  }
}

// ============================================================
// ICONS
// ============================================================

function AnalyticsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="13" width="4" height="8" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="4" width="4" height="17" rx="1" />
    </svg>
  )
}
function CallsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.11 1h4a2 2 0 0 1 2 1.72c.13.84.36 1.66.7 2.44a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.64-1.64a2 2 0 0 1 2.11-.45c.78.34 1.6.57 2.44.7A2 2 0 0 1 21 15z" />
    </svg>
  )
}
function ConfigIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function KbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  )
}
function BillingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
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
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" />
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
function CallIconBadge() {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{
        background:
          'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.1) 100%)',
        color: 'var(--accent-700)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.84.36 1.66.7 2.44a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.64-1.64a2 2 0 0 1 2.11-.45c.78.34 1.6.57 2.44.7A2 2 0 0 1 22 16.92z" />
      </svg>
    </div>
  )
}
function DocBadge() {
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
