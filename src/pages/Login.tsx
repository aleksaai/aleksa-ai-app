import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'

type Mode = 'login' | 'forgot'

export function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setStatus('error')
      setErrorMsg(
        error.message === 'Invalid login credentials'
          ? 'Email oder Passwort stimmt nicht.'
          : error.message,
      )
    }
    // On success: Auth context picks up session → automatic redirect
  }

  const handleGoogleLogin = async () => {
    setStatus('loading')
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    }
  }

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  // Email-sent success state (only for forgot-password)
  if (status === 'sent') {
    return (
      <AuthShell>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Email <span className="heading-accent">verschickt</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Wir haben dir eine Email an <strong className="text-ink-soft">{email}</strong> geschickt. Klick auf den Link, um dein Passwort neu zu setzen.
          </p>
          <button
            onClick={() => {
              setMode('login')
              setStatus('idle')
              setPassword('')
            }}
            className="btn-subtle mt-5 text-sm"
          >
            ← Zurück zum Login
          </button>
        </motion.div>
      </AuthShell>
    )
  }

  // Forgot-password form
  if (mode === 'forgot') {
    return (
      <AuthShell>
        <form onSubmit={handleForgotPassword} className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Passwort <span className="heading-accent">vergessen?</span>
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              Trag deine Email ein, wir schicken dir einen Link zum Zurücksetzen.
            </p>
          </div>

          <div>
            <label htmlFor="email" className="label-soft mb-2 block">Email</label>
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

          <button type="submit" disabled={status === 'loading' || !email} className="btn-primary w-full">
            {status === 'loading' ? 'Sende…' : 'Link senden'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('login')
              setStatus('idle')
              setErrorMsg('')
            }}
            className="btn-subtle w-full text-sm"
          >
            ← Zurück zum Login
          </button>
        </form>
      </AuthShell>
    )
  }

  // Default: email + password login form
  return (
    <AuthShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="heading-accent">Willkommen</span> zurück
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Anmelden mit Email + Passwort oder über Google.
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={status === 'loading'}
          className="btn-ghost w-full !py-2.5"
        >
          <GoogleIcon /> Mit Google anmelden
        </button>

        <div className="relative flex items-center gap-3 text-xs uppercase tracking-wider text-ink-dim">
          <span className="h-px flex-1 bg-black/10" />
          <span>oder</span>
          <span className="h-px flex-1 bg-black/10" />
        </div>

        {/* Email + Password */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="label-soft mb-2 block">Email</label>
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

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="password" className="label-soft">Passwort</label>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setStatus('idle')
                  setErrorMsg('')
                }}
                className="text-xs font-medium text-ink-muted hover:[color:var(--accent-700)]"
              >
                Vergessen?
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
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
            disabled={status === 'loading' || !email || !password}
            className="btn-primary w-full"
          >
            {status === 'loading' ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </AuthShell>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
