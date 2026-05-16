import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { getInvitationInfo, sendInvitationMagicLink, type InvitationInfo } from '../lib/api'
import { AuthShell } from '../components/AuthShell'

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
    <AuthShell>
      {error ? (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-red-700">Einladung ungültig</h1>
          <p className="text-sm text-ink-soft">
            {error === 'invitation_not_found' && 'Diese Einladung existiert nicht.'}
            {error === 'invitation_already_used' && 'Diese Einladung wurde bereits verwendet.'}
            {error === 'invitation_expired' && 'Diese Einladung ist abgelaufen.'}
            {!['invitation_not_found', 'invitation_already_used', 'invitation_expired'].includes(error) && error}
          </p>
          <p className="text-xs text-ink-muted">
            Bitte den Admin bitten, eine neue Einladung zu schicken.
          </p>
        </div>
      ) : !info ? (
        <div className="text-center text-sm text-ink-muted">Lade Einladung…</div>
      ) : sendStatus === 'sent' ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Magic-Link <span className="heading-accent">gesendet</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Wir haben dir eine E-Mail an <strong className="text-ink-soft">{info.email}</strong> geschickt. Klick auf den Link, um dein Konto zu aktivieren.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="eyebrow mb-1.5">Einladung</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="heading-accent">Willkommen</span> bei OpenPeng Voice
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Du wurdest als Kunde für <strong className="text-ink-soft">{info.customer_name}</strong> eingeladen.
            </p>
          </div>

          <div className="rounded-xl bg-white/50 p-4">
            <p className="label-soft mb-1">Deine Email</p>
            <p className="font-medium text-ink">{info.email}</p>
          </div>

          <button
            onClick={handleSend}
            disabled={sendStatus === 'sending'}
            className="btn-primary w-full"
          >
            {sendStatus === 'sending' ? 'Sende…' : 'Magic-Link an meine Email senden'}
          </button>

          {sendStatus === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
              {sendError}
            </div>
          )}

          <p className="text-xs text-ink-muted">
            Nach dem Klick wirst du durchs Onboarding geführt — Zahlungsmethode hinterlegen, dann ins Dashboard.
          </p>
        </div>
      )}
    </AuthShell>
  )
}
