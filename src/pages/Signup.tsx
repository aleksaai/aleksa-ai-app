// Public signup-request page.
// Anyone can submit a request to join the platform.
// Aleksa reviews requests under /admin/requests and either approves
// (which triggers a Magic-Link invite via the existing admin-create-customer
// edge function) or rejects.

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'

export function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.from('access_requests').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim() || null,
    })

    if (error) {
      setStatus('error')
      // Handle duplicate-email gracefully
      if (error.message.toLowerCase().includes('duplicate')) {
        setErrorMsg('Für diese Email gibt es schon eine Anfrage. Wir melden uns sobald sie geprüft wurde.')
      } else {
        setErrorMsg(error.message)
      }
    } else {
      setStatus('sent')
    }
  }

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
            Anfrage <span className="heading-accent">eingegangen</span>
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Wir prüfen deine Anfrage persönlich. Sobald du freigeschaltet bist,
            bekommst du einen Einladungs-Link an{' '}
            <strong className="text-ink-soft">{email}</strong>.
          </p>
          <Link to="/" className="btn-subtle mt-5 inline-block text-sm">
            ← Zurück zum Login
          </Link>
        </motion.div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="heading-accent">Zugang</span> anfragen
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Die Plattform ist für Mitglieder der <strong className="text-ink-soft">OpenPeng Community</strong> reserviert.
            Sende deine Anfrage mit der Email, mit der du auch dort registriert bist —
            wir prüfen das manuell und schicken dir einen Einladungs-Link.
          </p>
        </div>

        <div>
          <label htmlFor="name" className="label-soft mb-2 block">Vor- &amp; Nachname</label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stephan Müller"
            className="glass-input"
            disabled={status === 'loading'}
          />
        </div>

        <div>
          <label htmlFor="email" className="label-soft mb-2 block">
            Email <span className="text-ink-muted">(OpenPeng-Account)</span>
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

        <div>
          <label htmlFor="message" className="label-soft mb-2 block">
            Nachricht <span className="text-ink-muted">(optional)</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Kurz: was willst du mit Voice-Agents machen?"
            rows={3}
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
          disabled={status === 'loading' || !name || !email}
          className="btn-primary w-full"
        >
          {status === 'loading' ? 'Sende…' : 'Anfrage senden'}
        </button>

        <Link to="/" className="btn-subtle w-full text-sm block text-center">
          ← Schon einen Account? Zum Login
        </Link>
      </form>
    </AuthShell>
  )
}
