// /agency/settings/stripe-callback — bounce page after Stripe Connect OAuth.
//
// Stripe redirects here with ?code=&state= after the partner authorizes.
// We POST those to stripe-connect-callback, save the connected account,
// then redirect back to the partner's tenant subdomain.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { AuthShell } from '../components/AuthShell'
import { stripeConnectCallback } from '../lib/api'

export function StripeConnectCallback() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stripeErr = params.get('error')
    const code = params.get('code')
    const state = params.get('state')

    if (stripeErr) {
      setStatus('error')
      setError(params.get('error_description') ?? stripeErr)
      return
    }
    if (!code || !state) {
      setStatus('error')
      setError('Stripe hat code/state nicht zurückgegeben.')
      return
    }

    void (async () => {
      try {
        const r = await stripeConnectCallback({ code, state })
        setStatus('success')
        const targetOrigin = r.origin ?? window.location.origin
        setTimeout(() => {
          window.location.href = `${targetOrigin}/agency/settings`
        }, 1500)
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [params])

  return (
    <AuthShell>
      {status === 'processing' && (
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full"
            style={{ background: 'rgba(var(--accent-400-rgb), 0.3)' }}
          />
          <h1 className="text-lg font-semibold tracking-tight">Verbinde Stripe…</h1>
          <p className="mt-1 text-sm text-ink-muted">Einen kleinen Moment.</p>
        </div>
      )}
      {status === 'success' && (
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
            Stripe <span className="heading-accent">verbunden</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Wir leiten dich gleich zurück…</p>
        </motion.div>
      )}
      {status === 'error' && (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-red-700">Stripe-Verbindung fehlgeschlagen</h1>
          <p className="text-sm text-ink-soft">{error}</p>
          <a href="/agency/settings" className="btn-ghost text-sm">Zurück zu Einstellungen</a>
        </div>
      )}
    </AuthShell>
  )
}
