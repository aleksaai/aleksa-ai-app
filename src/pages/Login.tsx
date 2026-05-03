import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'

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
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card w-full max-w-md"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">AleksaAI App</h1>
          <p className="mt-1 text-sm text-slate-500">
            Anmelden mit deiner Email-Adresse
          </p>
        </div>

        {status === 'sent' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <p className="font-medium">Magic-Link gesendet ✓</p>
            <p className="mt-1">
              Wir haben dir eine Email an <strong>{email}</strong> geschickt. Klick auf den Link um dich anzumelden.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
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
                className="input"
                disabled={status === 'loading'}
              />
            </div>

            {status === 'error' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
      </motion.div>
    </div>
  )
}
