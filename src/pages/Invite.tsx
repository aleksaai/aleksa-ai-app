import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { getInvitationInfo, sendInvitationMagicLink, type InvitationInfo } from '../lib/api'

export function Invite() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    if (!token) return
    getInvitationInfo(token)
      .then((d) => setInfo(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [token])

  const handleSend = async () => {
    if (!token) return
    setSendStatus('sending')
    setSendError('')
    try {
      await sendInvitationMagicLink(token)
      setSendStatus('sent')
    } catch (e) {
      setSendStatus('error')
      setSendError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-md"
      >
        {error ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-red-700">Einladung ungültig</h1>
            <p className="text-sm text-slate-600">
              {error === 'invitation_not_found' && 'Diese Einladung existiert nicht.'}
              {error === 'invitation_already_used' && 'Diese Einladung wurde bereits verwendet.'}
              {error === 'invitation_expired' && 'Diese Einladung ist abgelaufen.'}
              {!['invitation_not_found', 'invitation_already_used', 'invitation_expired'].includes(error) && error}
            </p>
            <p className="text-xs text-slate-500">
              Bitte den Admin bitten eine neue Einladung zu schicken.
            </p>
          </div>
        ) : !info ? (
          <div className="text-sm text-slate-500">Lade Einladung…</div>
        ) : sendStatus === 'sent' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <h1 className="text-xl font-semibold text-emerald-700">Magic-Link gesendet ✓</h1>
            <p className="mt-2 text-sm text-slate-600">
              Wir haben dir eine Email an <strong>{info.email}</strong> geschickt.
              Klick auf den Link um dein Konto zu aktivieren.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">Willkommen bei AleksaAI</h1>
              <p className="mt-2 text-sm text-slate-600">
                Du wurdest als Customer-Owner für{' '}
                <strong>{info.customer_name}</strong> eingeladen.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{info.email}</p>
            </div>

            <button
              onClick={handleSend}
              disabled={sendStatus === 'sending'}
              className="btn-primary w-full"
            >
              {sendStatus === 'sending' ? 'Sende…' : 'Magic-Link an meine Email senden'}
            </button>

            {sendStatus === 'error' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {sendError}
              </div>
            )}

            <p className="text-xs text-slate-500">
              Wir schicken dir einen einmaligen Login-Link. Nach dem Klick wirst du
              durchs Onboarding geführt — Zahlungsmethode hinterlegen → Dashboard.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
