import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { adminCreateVoiceAgent } from '../lib/api'

type Props = {
  open: boolean
  customerId: string
  onClose: () => void
  onCreated: () => void
}

export function AddVoiceAgentDialog({ open, customerId, onClose, onCreated }: Props) {
  const [agentId, setAgentId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phoneId, setPhoneId] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  const reset = () => {
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
        elevenlabs_agent_id: agentId.trim(),
        display_name: displayName.trim() || undefined,
        elevenlabs_phone_number_id: phoneId.trim() || undefined,
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
            className="fixed inset-0 z-40 bg-slate-900/50" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Voice-Agent hinzufügen</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Verknüpft einen ElevenLabs-Agent mit diesem Customer. RetellAI-Support kommt in V1.5.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">ElevenLabs Agent ID</label>
                  <input
                    type="text"
                    required
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    placeholder="agent_xxx..."
                    className="input font-mono text-xs"
                  />
                  <p className="mt-1 text-xs text-slate-500">aus elevenlabs.io → Agents → Agent ID</p>
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

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Phone-Number ID (optional)
                  </label>
                  <input
                    type="text"
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    placeholder="phnum_xxx..."
                    className="input font-mono text-xs"
                  />
                </div>

                {status === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={handleClose} className="btn-ghost flex-1"
                    disabled={status === 'loading'}>Abbrechen</button>
                  <button type="submit" className="btn-primary flex-1"
                    disabled={status === 'loading' || !agentId}>
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
