import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, useStripe, useElements, PaymentElement, AddressElement } from '@stripe/react-stripe-js'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { getSetupIntent, linkInvitation, updateCustomerBusiness } from '../lib/api'
import { AuthShell } from '../components/AuthShell'

export function Onboarding() {
  const { user, signOut } = useAuth()
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState<'linking' | 'loading' | 'ready' | 'success' | 'error'>('linking')
  const [errorMsg, setErrorMsg] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

  useEffect(() => {
    if (!user) return
    const run = async () => {
      try {
        const tokenFromUrl = searchParams.get('invitation_token')
        const tokenFromMeta = (user.user_metadata as Record<string, unknown> | undefined)
          ?.invitation_token as string | undefined
        const token = tokenFromUrl ?? tokenFromMeta

        const { data: profile } = await supabase
          .from('profiles')
          .select('customer_id, role')
          .eq('id', user.id)
          .single()

        if (!profile?.customer_id && token) {
          await linkInvitation(token)
        } else if (!profile?.customer_id && !token) {
          throw new Error('Kein Invitation-Token gefunden. Bitte den Admin um eine neue Einladung.')
        }

        setPhase('loading')
        const r = await getSetupIntent()
        setClientSecret(r.client_secret)
        setStripePromise(loadStripe(r.publishable_key))
        setPhase('ready')
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    }
    run()
  }, [user, searchParams])

  return (
    <AuthShell>
      {(phase === 'linking' || phase === 'loading') && (
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full" style={{ background: 'rgba(var(--accent-400-rgb), 0.3)' }} />
          <h1 className="text-lg font-semibold tracking-tight">Einen Moment…</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {phase === 'linking' ? 'Verknüpfe dein Konto…' : 'Lade Zahlungs-Setup…'}
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-red-700">Etwas ist schiefgelaufen</h1>
          <p className="text-sm text-ink-soft">{errorMsg}</p>
          <button onClick={signOut} className="btn-ghost text-sm">Abmelden</button>
        </div>
      )}

      {phase === 'success' && (
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
            Alles <span className="heading-accent">eingerichtet</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Deine Zahlungsmethode ist hinterlegt. Du wirst gleich weitergeleitet…
          </p>
        </motion.div>
      )}

      {phase === 'ready' && clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <PaymentForm onSuccess={() => setPhase('success')} />
        </Elements>
      )}
    </AuthShell>
  )
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [customerType, setCustomerType] = useState<'b2c' | 'b2b'>('b2c')
  const [businessName, setBusinessName] = useState('')
  const [vatId, setVatId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErrMsg('')

    if (customerType === 'b2b' && (businessName.trim() || vatId.trim())) {
      try {
        await updateCustomerBusiness({
          business_name: businessName.trim() || undefined,
          vat_id: vatId.trim() || undefined,
        })
      } catch (e) {
        setErrMsg(
          `Unternehmensdaten konnten nicht gespeichert werden: ${
            e instanceof Error ? e.message : String(e)
          }`,
        )
        setSubmitting(false)
        return
      }
    }

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
      redirect: 'if_required',
    })

    if (error) {
      setErrMsg(error.message || 'Unbekannter Fehler beim Karten-Setup')
      setSubmitting(false)
      return
    }

    onSuccess()
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="eyebrow mb-1.5">Schritt 1 von 1</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="heading-accent">Zahlungsmethode</span> hinterlegen
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Du wirst noch nicht belastet. Wir hinterlegen deine Karte für die spätere automatische Abrechnung.
        </p>
      </div>

      {/* Customer type toggle */}
      <div>
        <label className="label-soft mb-2 block">Kundentyp</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCustomerType('b2c')}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              customerType === 'b2c' ? 'shadow-glass' : ''
            }`}
            style={
              customerType === 'b2c'
                ? {
                    background:
                      'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.25) 0%, rgba(var(--accent-400-rgb), 0.12) 100%)',
                    color: 'var(--accent-800)',
                    border: '1px solid rgba(var(--accent-400-rgb), 0.4)',
                  }
                : {
                    background: 'rgba(255,255,255,0.5)',
                    color: '#6c6880',
                    border: '1px solid rgba(255,255,255,0.6)',
                  }
            }
          >
            Privatperson
          </button>
          <button
            type="button"
            onClick={() => setCustomerType('b2b')}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all`}
            style={
              customerType === 'b2b'
                ? {
                    background:
                      'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.25) 0%, rgba(var(--accent-400-rgb), 0.12) 100%)',
                    color: 'var(--accent-800)',
                    border: '1px solid rgba(var(--accent-400-rgb), 0.4)',
                  }
                : {
                    background: 'rgba(255,255,255,0.5)',
                    color: '#6c6880',
                    border: '1px solid rgba(255,255,255,0.6)',
                  }
            }
          >
            Unternehmen
          </button>
        </div>
      </div>

      {/* B2B fields */}
      {customerType === 'b2b' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3 overflow-hidden rounded-xl bg-white/40 p-4"
        >
          <div>
            <label className="label-soft mb-2 block">Firmenname</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="z.B. Müller GmbH"
              className="glass-input"
            />
          </div>
          <div>
            <label className="label-soft mb-2 block">USt-ID (VAT)</label>
            <input
              type="text"
              value={vatId}
              onChange={(e) => setVatId(e.target.value.toUpperCase())}
              placeholder="z.B. DE123456789"
              className="glass-input font-mono"
              maxLength={14}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Mit gültiger EU-USt-ID greift das <strong className="text-ink-soft">Reverse-Charge-Verfahren</strong> → 0% MwSt.
            </p>
          </div>
        </motion.div>
      )}

      <div>
        <label className="label-soft mb-2 block">Rechnungsadresse</label>
        <div className="rounded-xl bg-white/50 p-3">
          <AddressElement
            options={{
              mode: 'billing',
              display: customerType === 'b2b' ? { name: 'organization' } : { name: 'full' },
            }}
          />
        </div>
      </div>

      <div>
        <label className="label-soft mb-2 block">Zahlungsmethode</label>
        <div className="rounded-xl bg-white/50 p-3">
          <PaymentElement />
        </div>
      </div>

      {errMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">{errMsg}</div>
      )}

      <button type="submit" disabled={!stripe || submitting} className="btn-primary w-full">
        {submitting ? 'Hinterlege Karte…' : 'Karte hinterlegen'}
      </button>

      <p className="text-xs text-ink-muted">
        Im Test-Modus: Stripe-Test-Karte <code className="rounded bg-white/60 px-1 py-0.5 font-mono text-[11px]">4242 4242 4242 4242</code>, beliebiges Datum + CVC.
      </p>
    </form>
  )
}
