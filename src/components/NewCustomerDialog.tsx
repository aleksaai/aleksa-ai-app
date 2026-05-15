import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { adminCreateCustomer, type CreateCustomerResult } from '../lib/api'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function NewCustomerDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateCustomerResult | null>(null)
  const [copiedInvite, setCopiedInvite] = useState(false)

  const reset = () => {
    setName('')
    setEmail('')
    setStatus('idle')
    setError('')
    setResult(null)
    setCopiedInvite(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError('')
    try {
      const r = await adminCreateCustomer({ name, contact_email: email })
      setResult(r)
      setStatus('success')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const copyInviteLink = async () => {
    if (!result?.invite_link) return
    await navigator.clipboard.writeText(result.invite_link)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <div
              className="card w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {status !== 'success' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Neuer Customer</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Legt einen Stripe-Customer an und schickt eine Email-Einladung mit Login-Link.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="cust-name" className="mb-1 block text-sm font-medium text-slate-700">
                      Firmenname / Anzeigename
                    </label>
                    <input
                      id="cust-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="z.B. VV-Cars Personenbeförderung"
                      className="input"
                      disabled={status === 'loading'}
                    />
                  </div>

                  <div>
                    <label htmlFor="cust-email" className="mb-1 block text-sm font-medium text-slate-700">
                      Kontakt-Email
                    </label>
                    <input
                      id="cust-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@vv-cars.de"
                      className="input"
                      disabled={status === 'loading'}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Diese Adresse bekommt die Einladungs-Mail.
                    </p>
                  </div>

                  {status === 'error' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-ghost flex-1"
                      disabled={status === 'loading'}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex-1"
                      disabled={status === 'loading' || !name || !email}
                    >
                      {status === 'loading' ? 'Lege an…' : 'Customer anlegen'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div
                      className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight">
                      <strong>{name}</strong> <span className="heading-accent">angelegt</span>
                    </h2>
                    <p className="mt-1.5 text-sm text-ink-muted">
                      {result?.email_sent
                        ? 'Die Einladungs-Mail wurde verschickt.'
                        : '⚠️ Die Email konnte nicht versandt werden — kopier den Link manuell.'}
                    </p>
                  </div>

                  {!result?.email_sent && (
                    <div className="rounded-xl bg-white/50 p-3">
                      <p className="label-soft mb-2">Einladungs-Link</p>
                      <button
                        onClick={copyInviteLink}
                        className="btn-ghost w-full text-xs"
                      >
                        {copiedInvite ? '✓ In Zwischenablage kopiert' : 'Link kopieren'}
                      </button>
                    </div>
                  )}

                  {result?.email_error && (
                    <div className="rounded-xl border border-amber-200/50 bg-amber-50/60 p-3 text-xs">
                      <p className="mb-1 font-medium text-amber-900">Resend-Fehler:</p>
                      <p className="break-words font-mono text-amber-800">{result.email_error}</p>
                    </div>
                  )}

                  <button onClick={handleClose} className="btn-primary w-full">
                    Fertig
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
