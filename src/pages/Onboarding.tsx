import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { getSetupIntent, linkInvitation } from '../lib/api'

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
        // Step 1 — Link invitation if there's a token in the URL or in user_metadata
        const tokenFromUrl = searchParams.get('invitation_token')
        const tokenFromMeta = (user.user_metadata as Record<string, unknown> | undefined)
          ?.invitation_token as string | undefined
        const token = tokenFromUrl ?? tokenFromMeta

        // Check if profile already has customer_id (already linked from prior session)
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

        // Step 2 — Fetch Stripe SetupIntent
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-md"
      >
        {(phase === 'linking' || phase === 'loading') && (
          <div className="space-y-3 text-center">
            <h1 className="text-xl font-semibold">Einen Moment…</h1>
            <p className="text-sm text-slate-500">
              {phase === 'linking' ? 'Verknüpfe dein Konto…' : 'Lade Zahlungs-Setup…'}
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-red-700">Etwas ist schiefgelaufen</h1>
            <p className="text-sm text-slate-600">{errorMsg}</p>
            <button onClick={signOut} className="btn-ghost text-sm">Abmelden</button>
          </div>
        )}

        {phase === 'success' && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-emerald-700">Alles eingerichtet ✓</h1>
            <p className="text-sm text-slate-600">
              Deine Zahlungsmethode ist hinterlegt. Du wirst gleich weitergeleitet…
            </p>
          </div>
        )}

        {phase === 'ready' && clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <PaymentForm onSuccess={() => setPhase('success')} />
          </Elements>
        )}
      </motion.div>
    </div>
  )
}

function PaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErrMsg('')

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: 'if_required',
    })

    if (error) {
      setErrMsg(error.message || 'Unbekannter Fehler beim Karten-Setup')
      setSubmitting(false)
      return
    }

    onSuccess()
    // Stripe webhook will set has_payment_method=true; navigate after a short delay
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Zahlungsmethode hinterlegen</h1>
        <p className="mt-1 text-sm text-slate-500">
          Du wirst noch nicht belastet. Wir hinterlegen deine Karte, damit wir
          dich monatlich automatisch abrechnen können sobald der Admin ein
          Pricing-Paket für dich aktiviert.
        </p>
      </div>

      <PaymentElement />

      {errMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="btn-primary w-full"
      >
        {submitting ? 'Hinterlege Karte…' : 'Karte hinterlegen'}
      </button>

      <p className="text-xs text-slate-500">
        Im Test-Modus kannst du die Stripe-Test-Karte <code>4242 4242 4242 4242</code>
        nutzen — beliebiges Datum in der Zukunft + beliebige CVC.
      </p>
    </form>
  )
}
