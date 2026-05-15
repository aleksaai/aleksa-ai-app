import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { adminCreateIntegration, type CreateIntegrationInput } from '../lib/api'
import type { IntegrationPlatform } from '../types/db'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const PLATFORM_LABEL: Record<IntegrationPlatform, string> = {
  elevenlabs: 'ElevenLabs',
  retellai: 'RetellAI',
  vapi: 'Vapi',
  openai: 'OpenAI',
}

export function NewIntegrationDialog({ open, onClose, onCreated }: Props) {
  const [platform, setPlatform] = useState<IntegrationPlatform | null>(null)
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [region, setRegion] = useState<'us' | 'eu'>('us')
  const [vapiPublic, setVapiPublic] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  const reset = () => {
    setPlatform(null)
    setName('')
    setApiKey('')
    setRegion('us')
    setVapiPublic('')
    setStatus('idle')
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!platform) return
    setStatus('loading')
    setError('')
    try {
      let input: CreateIntegrationInput
      if (platform === 'elevenlabs') {
        input = { platform, name, api_key: apiKey, region }
      } else if (platform === 'vapi') {
        input = { platform, name, api_key: apiKey, vapi_public_key: vapiPublic }
      } else if (platform === 'retellai') {
        input = { platform, name, api_key: apiKey }
      } else {
        input = { platform, name, api_key: apiKey }
      }
      await adminCreateIntegration(input)
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
              {!platform ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-xl font-semibold">Neue Integration</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Verbinde einen Voice-AI- oder LLM-Provider-Account. Du nutzt dieselbe
                      Integration für mehrere Agenten.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['elevenlabs', 'retellai', 'vapi', 'openai'] as IntegrationPlatform[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPlatform(p)
                          setName(`Mein ${PLATFORM_LABEL[p]}`)
                        }}
                        className="rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
                      >
                        <div className="text-sm font-semibold">{PLATFORM_LABEL[p]}</div>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={handleClose} className="btn-ghost w-full">
                    Abbrechen
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Verbinden: {PLATFORM_LABEL[platform]}</h2>
                    <button type="button" onClick={() => setPlatform(null)} className="mt-1 text-xs text-slate-500 underline">
                      ← anderen Provider wählen
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Integrations-Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`z.B. Mein ${PLATFORM_LABEL[platform]}`}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {PLATFORM_LABEL[platform]} API Key
                    </label>
                    <input
                      type="password"
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        platform === 'elevenlabs'
                          ? 'sk_...'
                          : platform === 'retellai'
                          ? 'key_...'
                          : platform === 'vapi'
                          ? 'priv_...'
                          : 'sk-...'
                      }
                      className="input font-mono text-xs"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {platform === 'elevenlabs' && 'Aus elevenlabs.io → Profile → API Keys'}
                      {platform === 'retellai' && 'Aus retellai.com → Settings → API Keys'}
                      {platform === 'vapi' && 'Aus vapi.ai → Dashboard → API Keys (Private)'}
                      {platform === 'openai' && 'Aus platform.openai.com → API keys'}
                    </p>
                  </div>

                  {platform === 'vapi' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Vapi Public API Key</label>
                      <input
                        type="text"
                        required
                        value={vapiPublic}
                        onChange={(e) => setVapiPublic(e.target.value)}
                        placeholder="pub_..."
                        className="input font-mono text-xs"
                      />
                    </div>
                  )}

                  {platform === 'elevenlabs' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Region</label>
                      <p className="mb-2 text-xs text-slate-500">
                        Wo der ElevenLabs-Account gehostet ist (nicht dein physischer Standort).
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRegion('us')}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            region === 'us'
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          US
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegion('eu')}
                          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            region === 'eu'
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          EU
                        </button>
                      </div>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={handleClose} className="btn-ghost flex-1"
                      disabled={status === 'loading'}>Stornieren</button>
                    <button type="submit" className="btn-primary flex-1"
                      disabled={status === 'loading' || !name || !apiKey || (platform === 'vapi' && !vapiPublic)}>
                      {status === 'loading' ? 'Verbinde…' : 'Verbinden'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
