import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { adminCreateVoiceAgent } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Integration, IntegrationPlatform } from '../types/db'

type Props = {
  open: boolean
  customerId: string
  onClose: () => void
  onCreated: () => void
}

const PLATFORM_PLACEHOLDER: Record<IntegrationPlatform, { label: string; placeholder: string; phoneHint: string }> = {
  elevenlabs: { label: 'ElevenLabs Agent ID', placeholder: 'agent_xxx...', phoneHint: 'phnum_xxx... (optional)' },
  retellai: { label: 'RetellAI Agent ID', placeholder: 'ag_xxx...', phoneHint: '+49... (optional)' },
  vapi: { label: 'Vapi Assistant ID', placeholder: 'asst_xxx...', phoneHint: 'phone_xxx... (optional)' },
  openai: { label: 'OpenAI Model / Assistant ID', placeholder: 'asst_xxx...', phoneHint: 'n/a' },
}

export function AddVoiceAgentDialog({ open, customerId, onClose, onCreated }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationId, setIntegrationId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phoneId, setPhoneId] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    supabase
      .from('integrations')
      .select('id, name, platform, region, active, created_at, updated_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setIntegrations((data ?? []) as Integration[]))
  }, [open])

  const reset = () => {
    setIntegrationId('')
    setAgentId('')
    setDisplayName('')
    setPhoneId('')
    setStatus('idle')
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      await adminCreateVoiceAgent({
        customer_id: customerId,
        integration_id: integrationId,
        platform_agent_id: agentId.trim(),
        display_name: displayName.trim() || undefined,
        platform_phone_number_id: phoneId.trim() || undefined,
      })
      onCreated()
      handleClose()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const selectedIntegration = integrations.find((i) => i.id === integrationId)
  const placeholder = selectedIntegration
    ? PLATFORM_PLACEHOLDER[selectedIntegration.platform]
    : null

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/50" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Voice-Agent hinzufügen</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Wähle die Integration und verknüpfe die Agent-ID vom Provider.
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

                    {placeholder && (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">{placeholder.label}</label>
                          <input
                            type="text"
                            required
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value)}
                            placeholder={placeholder.placeholder}
                            className="input font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Anzeige-Name (optional)
                          </label>
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="z.B. Kati — Sofort-Buchung"
                            className="input"
                          />
                        </div>

                        {selectedIntegration?.platform !== 'openai' && (
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                              Phone-Number-ID (optional)
                            </label>
                            <input
                              type="text"
                              value={phoneId}
                              onChange={(e) => setPhoneId(e.target.value)}
                              placeholder={placeholder.phoneHint}
                              className="input font-mono text-xs"
                            />
                          </div>
                        )}
                      </>
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
                    disabled={status === 'loading' || !integrationId || !agentId || integrations.length === 0}>
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
