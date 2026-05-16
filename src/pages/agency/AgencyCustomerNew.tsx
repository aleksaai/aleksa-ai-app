// /agency/customers/new — partner creates a new customer.

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { AgencyShell } from '../../components/AgencyShell'
import { agencyCreateCustomer } from '../../lib/api'

export function AgencyCustomerNew() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ customer_id: string; email_sent: boolean } | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await agencyCreateCustomer({ name: name.trim(), contact_email: email.trim() })
      setResult({ customer_id: r.customer_id, email_sent: r.email_sent })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AgencyShell
      pageEyebrow="Neuer Kunde"
      pageTitle={<>Kunde <span className="heading-accent">anlegen</span></>}
      backTo="/agency/customers"
      backLabel="Zur Kundenliste"
    >
      {result ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card-lg max-w-xl p-7">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-center text-xl font-semibold tracking-tight">
            Kunde <span className="heading-accent">angelegt</span>
          </h2>
          <p className="mt-2 text-center text-sm text-ink-muted">
            {result.email_sent
              ? `Eine Einladungs-Email wurde an ${email} verschickt.`
              : `Der Kunde ist angelegt, aber das Email-Verschicken ist fehlgeschlagen. Du kannst den Einladungs-Link manuell weiterreichen.`}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={() => navigate(`/agency/customers/${result.customer_id}`)} className="btn-primary">
              Zum Kunden →
            </button>
            <button
              onClick={() => {
                setResult(null)
                setName('')
                setEmail('')
              }}
              className="btn-ghost"
            >
              Noch einen anlegen
            </button>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card-lg max-w-xl space-y-5 p-7">
          <div>
            <label htmlFor="customer_name" className="label-soft mb-2 block">Name</label>
            <input
              id="customer_name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mustermann GmbH"
              className="glass-input"
              required
              maxLength={120}
              autoFocus
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor="customer_email" className="label-soft mb-2 block">Kontakt-Email</label>
            <input
              id="customer_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="info@mustermann.de"
              className="glass-input"
              required
              disabled={busy}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              An diese Adresse geht ein Einladungs-Link für den Kunden-Login.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy || !name || !email} className="btn-primary w-full">
            {busy ? 'Lege an…' : 'Kunde anlegen + Einladen'}
          </button>
        </form>
      )}
    </AgencyShell>
  )
}
