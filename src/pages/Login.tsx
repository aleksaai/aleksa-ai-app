import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'

export function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <AuthShell>
      {status === 'sent' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            }}
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
            Magic-Link <span className="heading-accent">gesendet</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Wir haben dir eine E-Mail an <strong className="text-ink-soft">{email}</strong> geschickt. Klick auf den Link, um dich anzumelden.
          </p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="heading-accent">Willkommen</span> zurück
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Anmelden mit deiner Email-Adresse. Wir schicken dir einen einmaligen Login-Link.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="label-soft mb-2 block">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@example.com"
              className="glass-input"
              disabled={status === 'loading'}
            />
          </div>

          {status === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading' || !email}
            className="btn-primary w-full"
          >
            {status === 'loading' ? 'Senden…' : 'Magic-Link senden'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
