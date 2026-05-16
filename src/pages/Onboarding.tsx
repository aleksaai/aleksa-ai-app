// Onboarding flow for new community members + partner-invited customers.
//
// Flow: linking → (password) → (payment) → done
//
// - linking: link the invitation token to this auth user (creates profile row,
//   joins customers / community members tables as needed)
// - password: required only for email-signup users that haven't set one yet
// - payment: required only for partner-customers (= customer has stripe_customer_id
//   + stripe_account_id set, meaning the partner has a Stripe Connect account)
//
// Pure community-members (Aleksa's master flow, no agency) skip both extra
// steps and finish straight after linking.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { linkInvitation } from '../lib/api'
import { AuthShell } from '../components/AuthShell'
import { PaymentSetupForm } from '../components/PaymentSetupForm'

type Phase = 'linking' | 'password' | 'payment' | 'success' | 'error'

type CustomerSnapshot = {
  id: string
  has_payment_method: boolean
  stripe_customer_id: string | null
  stripe_account_id: string | null
  customer_kind: string | null
}

export function Onboarding() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('linking')
  const [errorMsg, setErrorMsg] = useState('')
  const [customer, setCustomer] = useState<CustomerSnapshot | null>(null)

  const finish = () => {
    setPhase('success')
    setTimeout(() => navigate('/'), 1500)
  }

  // After password is set (or skipped), decide whether to collect payment.
  const continueAfterPassword = (c: CustomerSnapshot | null) => {
    const needsPayment =
      !!c &&
      c.customer_kind === 'voice_customer' &&
      !!c.stripe_customer_id &&
      !c.has_payment_method
    if (needsPayment) {
      setPhase('payment')
    } else {
      finish()
    }
  }

  useEffect(() => {
    if (!user) return
    const run = async () => {
      try {
        const accessRequestId = (user.user_metadata as Record<string, unknown> | undefined)
          ?.access_request_id as string | undefined
        if (accessRequestId) {
          navigate(`/agency-onboarding?request_id=${accessRequestId}`, { replace: true })
          return
        }

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

        // Re-fetch profile after linkInvitation may have populated customer_id.
        const { data: profileAfter } = await supabase
          .from('profiles')
          .select('customer_id')
          .eq('id', user.id)
          .single()

        let snapshot: CustomerSnapshot | null = null
        if (profileAfter?.customer_id) {
          const { data: c } = await supabase
            .from('customers')
            .select('id, has_payment_method, stripe_customer_id, stripe_account_id, customer_kind')
            .eq('id', profileAfter.customer_id)
            .single()
          snapshot = (c as CustomerSnapshot | null) ?? null
          setCustomer(snapshot)
        }

        const isOAuth = user.app_metadata?.provider && user.app_metadata.provider !== 'email'
        const passwordAlreadySet = (user.user_metadata as Record<string, unknown> | undefined)
          ?.password_set === true

        if (isOAuth || passwordAlreadySet) {
          continueAfterPassword(snapshot)
        } else {
          setPhase('password')
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams])

  return (
    <AuthShell>
      {phase === 'linking' && (
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full"
            style={{ background: 'rgba(var(--accent-400-rgb), 0.3)' }}
          />
          <h1 className="text-lg font-semibold tracking-tight">Einen Moment…</h1>
          <p className="mt-1 text-sm text-ink-muted">Wir verknüpfen dein Konto.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-red-700">Etwas ist schiefgelaufen</h1>
          <p className="text-sm text-ink-soft">{errorMsg}</p>
          <button onClick={signOut} className="btn-ghost text-sm">
            Abmelden
          </button>
        </div>
      )}

      {phase === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#047857"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Konto <span className="heading-accent">eingerichtet</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Du wirst gleich weitergeleitet…</p>
        </motion.div>
      )}

      {phase === 'password' && (
        <PasswordSetupForm onDone={() => continueAfterPassword(customer)} />
      )}
      {phase === 'payment' && <PaymentSetupForm onDone={finish} />}
    </AuthShell>
  )
}

function PasswordSetupForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Mindestens 8 Zeichen.')
      return
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    setSubmitting(true)
    setError('')
    const { error: upErr } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    })
    if (upErr) {
      setError(upErr.message)
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
          Wähle ein <span className="heading-accent">Passwort</span>
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Damit du dich später jederzeit ohne Magic-Link anmelden kannst.
        </p>
      </div>

      <div>
        <label htmlFor="pw" className="label-soft mb-2 block">
          Passwort
        </label>
        <input
          id="pw"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mindestens 8 Zeichen"
          className="glass-input"
          disabled={submitting}
        />
      </div>

      <div>
        <label htmlFor="confirm" className="label-soft mb-2 block">
          Wiederholen
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="glass-input"
          disabled={submitting}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !password || !confirm}
        className="btn-primary w-full"
      >
        {submitting ? 'Speichere…' : 'Weiter'}
      </button>
    </form>
  )
}
