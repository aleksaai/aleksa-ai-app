// User account settings page.
// Lets the user link/unlink Google (for 1-click login on top of their
// email+password account) and change their password.
// Works for both admin and customer-owner — we wrap in the appropriate shell.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { AppShell } from '../components/AppShell'
import { CustomerShell } from '../components/CustomerShell'

type Identity = {
  identity_id?: string
  id?: string
  user_id: string
  provider: string
  identity_data?: Record<string, unknown>
  last_sign_in_at?: string
  created_at?: string
}

export function Account() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const loadIdentities = async () => {
    setLoading(true)
    const { data } = await (supabase.auth as any).getUserIdentities()
    if (data?.identities) setIdentities(data.identities as Identity[])
    setLoading(false)
  }

  useEffect(() => {
    loadIdentities()
  }, [])

  const googleIdentity = identities.find((i) => i.provider === 'google')
  const emailIdentity = identities.find((i) => i.provider === 'email')

  const handleLinkGoogle = async () => {
    setBusy('link-google')
    setError('')
    const { error: e } = await (supabase.auth as any).linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/account` },
    })
    if (e) {
      setError(e.message)
      setBusy(null)
    }
    // Otherwise OAuth redirect happens — we land back on /account
  }

  const handleUnlinkGoogle = async () => {
    if (!googleIdentity) return
    if (identities.length <= 1) {
      setError('Du kannst die letzte Anmelde-Methode nicht entfernen.')
      return
    }
    if (!confirm('Google-Verknüpfung aufheben? Du kannst sie jederzeit neu verknüpfen.')) return
    setBusy('unlink-google')
    setError('')
    const { error: e } = await (supabase.auth as any).unlinkIdentity(googleIdentity)
    if (e) {
      setError(e.message)
    } else {
      setInfo('Google-Verknüpfung aufgehoben.')
      setTimeout(() => setInfo(''), 3000)
      await loadIdentities()
    }
    setBusy(null)
  }

  const content = (
    <div className="space-y-5">
      <div className="glass-card-lg p-7">
        <p className="eyebrow mb-1.5">Konto</p>
        <h2 className="text-2xl font-semibold tracking-tight">{user?.email}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {profile?.role === 'admin' ? 'Plattform-Admin' : 'Kunden-Account'}
        </p>
      </div>

      {/* Login-Methoden */}
      <div className="glass-card p-6">
        <h3 className="font-semibold tracking-tight">Anmelde-Methoden</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Wähle wie du dich einloggen möchtest. Mehrere Methoden gleichzeitig sind erlaubt.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-ink-muted">Lade…</p>
        ) : (
          <div className="mt-5 space-y-3">
            {/* Email + Password */}
            <div className="flex items-center justify-between rounded-xl bg-white/40 p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.1) 100%)',
                    color: 'var(--accent-700)',
                  }}
                >
                  <MailIcon />
                </div>
                <div>
                  <p className="text-sm font-medium">Email & Passwort</p>
                  <p className="text-xs text-ink-muted">
                    {emailIdentity ? user?.email : 'Nicht aktiv'}
                  </p>
                </div>
              </div>
              {emailIdentity && (
                <span className="pill-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Aktiv
                </span>
              )}
            </div>

            {/* Google */}
            <div className="flex items-center justify-between rounded-xl bg-white/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
                  <GoogleIcon />
                </div>
                <div>
                  <p className="text-sm font-medium">Google</p>
                  <p className="text-xs text-ink-muted">
                    {googleIdentity
                      ? `Verknüpft mit ${(googleIdentity.identity_data as { email?: string })?.email ?? user?.email}`
                      : '1-Klick-Login mit deinem Google-Account'}
                  </p>
                </div>
              </div>
              {googleIdentity ? (
                <button
                  onClick={handleUnlinkGoogle}
                  disabled={busy !== null}
                  className="btn-ghost text-sm"
                >
                  {busy === 'unlink-google' ? '…' : 'Entfernen'}
                </button>
              ) : (
                <button
                  onClick={handleLinkGoogle}
                  disabled={busy !== null}
                  className="btn-primary text-sm"
                >
                  {busy === 'link-google' ? '…' : 'Verknüpfen'}
                </button>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}
          {info && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl border border-emerald-200/50 bg-emerald-50/60 p-3 text-sm text-emerald-800"
            >
              {info}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Password change */}
      {emailIdentity && <PasswordChangeCard />}
    </div>
  )

  const backTo = profile?.role === 'admin' ? '/admin' : '/dashboard'

  if (profile?.role === 'admin') {
    return (
      <AppShell
        backTo={backTo}
        backLabel="Zurück"
        pageEyebrow="Einstellungen"
        pageTitle={
          <>
            Mein <span className="heading-accent">Konto</span>
          </>
        }
      >
        {content}
      </AppShell>
    )
  }

  return (
    <CustomerShell
      backTo={backTo}
      backLabel="Zurück"
      pageEyebrow="Einstellungen"
      pageTitle={
        <>
          Mein <span className="heading-accent">Konto</span>
        </>
      }
    >
      {content}
    </CustomerShell>
  )
}

function PasswordChangeCard() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Mindestens 8 Zeichen.')
      setStatus('error')
      return
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      setStatus('error')
      return
    }
    setStatus('saving')
    setError('')
    const { error: e2 } = await supabase.auth.updateUser({ password })
    if (e2) {
      setError(e2.message)
      setStatus('error')
    } else {
      setStatus('success')
      setPassword('')
      setConfirm('')
      setTimeout(() => {
        setStatus('idle')
        setOpen(false)
      }, 2000)
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold tracking-tight">Passwort ändern</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Setze ein neues Passwort für dein Konto.
          </p>
        </div>
        <button onClick={() => setOpen(!open)} className="btn-ghost text-sm">
          {open ? 'Schließen' : 'Ändern'}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="mt-5 space-y-4 overflow-hidden"
          >
            <div>
              <label className="label-soft mb-2 block">Neues Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="glass-input"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="label-soft mb-2 block">Wiederholen</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="glass-input"
                autoComplete="new-password"
                required
              />
            </div>
            {status === 'error' && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {status === 'success' && (
              <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/60 p-3 text-sm text-emerald-800">
                Passwort gespeichert ✓
              </div>
            )}
            <button
              type="submit"
              disabled={status === 'saving' || !password || !confirm}
              className="btn-primary w-full"
            >
              {status === 'saving' ? 'Speichere…' : 'Passwort speichern'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
