// Stripe Elements card-collection form used during onboarding.
//
// For partner-customers the SetupIntent lives on the partner's Connected
// Account. We pass that via `stripeAccount` to loadStripe so Elements can
// tokenise on the right account — without it Stripe would silently use the
// platform account and the resulting payment method would be unusable.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { loadStripe, type Stripe as StripeClient } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getSetupIntent, confirmSetupIntent } from '../lib/api'

type Props = {
  onDone: () => void
}

export function PaymentSetupForm({ onDone }: Props) {
  const [intent, setIntent] = useState<{
    client_secret: string
    setup_intent_id: string
    publishable_key: string
    stripe_account_id: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<Promise<StripeClient | null> | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const r = await getSetupIntent()
        if (cancelled) return
        setIntent({
          client_secret: r.client_secret,
          setup_intent_id: r.setup_intent_id,
          publishable_key: r.publishable_key,
          stripe_account_id: r.stripe_account_id,
        })
        setStripePromise(
          loadStripe(
            r.publishable_key,
            r.stripe_account_id ? { stripeAccount: r.stripe_account_id } : undefined,
          ),
        )
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void run()
    return () => { cancelled = true }
  }, [])

  const elementsOptions = useMemo(
    () =>
      intent
        ? {
            clientSecret: intent.client_secret,
            appearance: {
              theme: 'flat' as const,
              variables: {
                colorPrimary: 'var(--accent-500)',
                colorBackground: '#ffffff',
                borderRadius: '12px',
                fontFamily: 'Inter, system-ui, sans-serif',
              },
            },
          }
        : null,
    [intent],
  )

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
        Konnte Zahlungsmethode nicht initialisieren: {error}
      </div>
    )
  }
  if (!intent || !stripePromise || !elementsOptions) {
    return (
      <div className="text-center text-sm text-ink-muted">
        Lade Zahlungsformular…
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={elementsOptions}>
      <InnerForm setupIntentId={intent.setup_intent_id} onDone={onDone} />
    </Elements>
  )
}

function InnerForm({ setupIntentId, onDone }: { setupIntentId: string; onDone: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    const result = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })
    if (result.error) {
      setError(result.error.message ?? 'Unbekannter Fehler')
      setSubmitting(false)
      return
    }

    try {
      await confirmSetupIntent(setupIntentId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
      return
    }

    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="eyebrow mb-1.5">Letzter Schritt</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hinterlege deine <span className="heading-accent">Zahlungsmethode</span>
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Wird nur belastet wenn du tatsächlich Voice-Agent-Nutzung abrechnest.
        </p>
      </div>

      <div className="rounded-xl bg-white/70 p-4">
        <PaymentElement />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="btn-primary w-full"
      >
        {submitting ? 'Speichere…' : 'Karte hinterlegen'}
      </button>
    </form>
  )
}
