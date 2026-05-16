// Reset-Password page — landed-on after clicking the link in the "forgot
// password" email. Supabase delivers a session in the URL hash, so by the
// time this page renders the user is already authenticated and can update
// their password directly.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    // Supabase parses the URL hash + creates a session. Check we have one.
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session))
    })
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setErrorMsg('Das Passwort muss mindestens 8 Zeichen lang sein.')
      setStatus('error')
      return
    }
    if (password !== confirm) {
      setErrorMsg('Die Passwörter stimmen nicht überein.')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('success')
      setTimeout(() => navigate('/'), 1500)
    }
  }

  if (!hasSession) {
    return (
      <AuthShell>
        <div className="space-y-3">
          <h1 className="text-xl font-semibold text-red-700">Link ungültig oder abgelaufen</h1>
          <p className="text-sm text-ink-soft">
            Dieser Reset-Link ist nicht mehr gültig. Fordere einen neuen an.
          </p>
          <button onClick={() => navigate('/')} className="btn-ghost mt-3 w-full text-sm">
            ← Zurück zum Login
          </button>
        </div>
      </AuthShell>
    )
  }

  if (status === 'success') {
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
            Passwort <span className="heading-accent">gesetzt</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Du wirst gleich weitergeleitet…</p>
        </motion.div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Neues <span className="heading-accent">Passwort</span>
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Mindestens 8 Zeichen. Nach dem Speichern bist du direkt angemeldet.
          </p>
        </div>

        <div>
          <label htmlFor="pw" className="label-soft mb-2 block">Neues Passwort</label>
          <input
            id="pw"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="glass-input"
            disabled={status === 'loading'}
          />
        </div>

        <div>
          <label htmlFor="confirm" className="label-soft mb-2 block">Wiederholen</label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          disabled={status === 'loading' || !password || !confirm}
          className="btn-primary w-full"
        >
          {status === 'loading' ? 'Speichere…' : 'Passwort speichern'}
        </button>
      </form>
    </AuthShell>
  )
}
