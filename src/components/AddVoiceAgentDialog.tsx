import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { adminCreateVoiceAgent, adminListPlatformAgents, type ListedPlatformAgent } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Integration } from '../types/db'

type Props = {
  open: boolean
  customerId: string
  onClose: () => void
  onCreated: () => void
}

export function AddVoiceAgentDialog({ open, customerId, onClose, onCreated }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationId, setIntegrationId] = useState('')
  const [platformAgents, setPlatformAgents] = useState<ListedPlatformAgent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [agentsError, setAgentsError] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  // Load integrations when dialog opens
  useEffect(() => {
    if (!open) return
    supabase
      .from('integrations')
      .select('id, name, platform, region, active, created_at, updated_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setIntegrations((data ?? []) as Integration[]))
  }, [open])

  // When integration changes → fetch its agents from the provider API
  useEffect(() => {
    if (!integrationId) {
      setPlatformAgents([])
      setSelectedAgentId('')
      setAgentsError('')
      return
    }
    setLoadingAgents(true)
    setAgentsError('')
    setPlatformAgents([])
    setSelectedAgentId('')
    adminListPlatformAgents(integrationId)
      .then((r) => setPlatformAgents(r.agents))
      .catch((e) => setAgentsError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingAgents(false))
  }, [integrationId])

  // When agent is picked → prefill displayName from the agent's name
  useEffect(() => {
    if (!selectedAgentId) {
      setDisplayName('')
      return
    }
    const a = platformAgents.find((x) => x.platform_agent_id === selectedAgentId)
    if (a) setDisplayName(a.name)
  }, [selectedAgentId, platformAgents])

  const reset = () => {
    setIntegrationId('')
    setPlatformAgents([])
    setSelectedAgentId('')
    setDisplayName('')
    setStatus('idle')
    setError('')
    setAgentsError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedAgentId) return

    const picked = platformAgents.find((a) => a.platform_agent_id === selectedAgentId)
    if (!picked) return

    setStatus('loading')
    setError('')
    try {
      await adminCreateVoiceAgent({
        customer_id: customerId,
        integration_id: integrationId,
        platform_agent_id: picked.platform_agent_id,
        display_name: displayName.trim() || picked.name,
        platform_phone_number_id: picked.platform_phone_number_id ?? undefined,
      })
      onCreated()
      handleClose()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Voice-Agent hinzufügen</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Wähle die Integration und dann den Agent direkt aus deinem Provider-Konto.
                  </p>
                </div>

                {integrations.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Du hast noch keine Integrationen verbunden.{' '}
                    <Link to="/admin/integrations" className="underline">Erst Integration anlegen</Link>.
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Integration</label>
                      <select
                        required
                        value={integrationId}
                        onChange={(e) => setIntegrationId(e.target.value)}
                        className="input"
                      >
                        <option value="">— wählen —</option>
                        {integrations.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.platform}{i.region ? `, ${i.region.toUpperCase()}` : ''})
                          </option>
                        ))}
                      </select>
                    </div>

                    {integrationId && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Agent</label>
                        {loadingAgents ? (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                            Lade Agents von Provider…
                          </div>
                        ) : agentsError ? (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {agentsError}
                          </div>
                        ) : platformAgents.length === 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            Keine Agents im Provider-Konto gefunden.
                          </div>
                        ) : (
                          <>
                            <select
                              required
                              value={selectedAgentId}
                              onChange={(e) => setSelectedAgentId(e.target.value)}
                              className="input"
                            >
                              <option value="">— wählen —</option>
                              {platformAgents.map((a) => (
                                <option key={a.platform_agent_id} value={a.platform_agent_id}>
                                  {a.name}
                                  {a.phone_number_e164 ? ` · 📞 ${a.phone_number_e164}` : ''}
                                </option>
                              ))}
                            </select>
                            {selectedAgentId && (() => {
                              const a = platformAgents.find((x) => x.platform_agent_id === selectedAgentId)
                              return a ? (
                                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                                  <div className="font-mono text-slate-500">{a.platform_agent_id}</div>
                                  {a.platform_phone_number_id && (
                                    <div className="mt-1 font-mono text-slate-500">
                                      📞 {a.phone_number_e164 ?? a.platform_phone_number_id}
                                    </div>
                                  )}
                                </div>
                              ) : null
                            })()}
                          </>
                        )}
                      </div>
                    )}

                    {selectedAgentId && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Anzeige-Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Optional — Standard ist der Name vom Provider"
                          className="input"
                        />
                      </div>
                    )}
                  </>
                )}

                {status === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={handleClose} className="btn-ghost flex-1"
                    disabled={status === 'loading'}>Abbrechen</button>
                  <button type="submit" className="btn-primary flex-1"
                    disabled={status === 'loading' || !selectedAgentId}>
                    {status === 'loading' ? 'Lege an…' : 'Hinzufügen'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
