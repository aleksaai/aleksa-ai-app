import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, useStripe, useElements, PaymentElement, AddressElement } from '@stripe/react-stripe-js'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { getSetupIntent, linkInvitation, updateCustomerBusiness } from '../lib/api'

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
  const [customerType, setCustomerType] = useState<'b2c' | 'b2b'>('b2c')
  const [businessName, setBusinessName] = useState('')
  const [vatId, setVatId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErrMsg('')

    // 1. If B2B: set business name + VAT ID on Stripe Customer FIRST so that
    //    Stripe Tax can apply Reverse-Charge when the subscription is later created.
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
          }`
        )
        setSubmitting(false)
        return
      }
    }

    // 2. Persist the billing address + payment method via Stripe Elements
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
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Zahlungsmethode hinterlegen</h1>
        <p className="mt-1 text-sm text-slate-500">
          Du wirst noch nicht belastet. Wir hinterlegen deine Karte für die spätere
          automatische Abrechnung.
        </p>
      </div>

      {/* Customer type selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Kundentyp</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCustomerType('b2c')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              customerType === 'b2c'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Privatperson
          </button>
          <button
            type="button"
            onClick={() => setCustomerType('b2b')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              customerType === 'b2b'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Unternehmen (USt-ID)
          </button>
        </div>
      </div>

      {/* B2B fields */}
      {customerType === 'b2b' && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Firmenname</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="z.B. Müller GmbH"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">USt-ID (VAT ID)</label>
            <input
              type="text"
              value={vatId}
              onChange={(e) => setVatId(e.target.value.toUpperCase())}
              placeholder="z.B. DE123456789"
              className="input font-mono"
              maxLength={14}
            />
            <p className="mt-1 text-xs text-slate-500">
              Mit gültiger EU-USt-ID greift das <strong>Reverse-Charge-Verfahren</strong> →
              0% MwSt auf der Rechnung. Wird von Stripe gegen die EU-VIES-Datenbank validiert.
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Rechnungsadresse</label>
        <AddressElement
          options={{
            mode: 'billing',
            display: customerType === 'b2b' ? { name: 'organization' } : { name: 'full' },
          }}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Zahlungsmethode</label>
        <PaymentElement />
      </div>

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
        Im Test-Modus kannst du die Stripe-Test-Karte <code>4242 4242 4242 4242</code>{' '}
        nutzen — beliebiges Datum in der Zukunft + beliebige CVC.
      </p>
    </form>
  )
}
