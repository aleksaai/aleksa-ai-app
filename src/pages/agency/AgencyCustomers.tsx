// /agency/customers — list of customers belonging to this agency.
// Phase C: read-only list + "create" button stub. Phase D wires up creation
// (mirrors admin-create-customer with agency_id set automatically).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AgencyShell } from '../../components/AgencyShell'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Customer } from '../../types/db'

export function AgencyCustomers() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.agency_id) return
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) setError(error.message)
      else setCustomers((data ?? []) as Customer[])
      setLoading(false)
    }
    void load()
  }, [profile?.agency_id])

  return (
    <AgencyShell
      pageEyebrow="Kunden"
      pageTitle={<>Deine <span className="heading-accent">Kunden</span></>}
      pageAction={
        <Link to="/agency/customers/new" className="btn-primary">
          + Neuer Kunde
        </Link>
      }
    >
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          Fehler beim Laden: {error}
        </div>
      ) : customers.length === 0 ? (
        <div className="glass-card-lg p-10 text-center">
          <p className="text-base font-medium text-ink">Noch keine Kunden</p>
          <p className="mt-2 text-sm text-ink-muted">
            Lege deinen ersten Kunden an, um Voice-Agents zu vergeben und Anrufe zu tracken.
          </p>
          <Link to="/agency/customers/new" className="btn-primary mt-5 inline-flex">
            Ersten Kunden anlegen
          </Link>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <ul className="divide-y divide-white/60">
            {customers.map((c) => (
              <li key={c.id} className="px-5 py-4 transition-colors hover:bg-white/50">
                <Link to={`/agency/customers/${c.id}`} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-muted">{c.contact_email}</p>
                  </div>
                  <span className="text-xs text-ink-muted">
                    {new Date(c.created_at).toLocaleDateString('de-DE')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AgencyShell>
  )
}
