// Admin view of incoming access requests.
// Approve → triggers the existing admin-create-customer edge function with
// the requester's name+email → Magic-Link invite goes out.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '../lib/supabase'
import { adminCreateCustomer } from '../lib/api'
import { AppShell } from '../components/AppShell'

type AccessRequest = {
  id: string
  email: string
  name: string
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  processed_at: string | null
  admin_note: string | null
}

export function Requests() {
  const [list, setList] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setList((data ?? []) as AccessRequest[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleApprove = async (req: AccessRequest) => {
    if (req.status !== 'pending') return
    setBusy(req.id)
    setError(null)
    try {
      // Trigger existing customer-creation flow → sends Magic-Link
      await adminCreateCustomer({ name: req.name, contact_email: req.email })
      // Mark request as approved
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: user?.id ?? null,
        })
        .eq('id', req.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const handleReject = async (req: AccessRequest) => {
    if (req.status !== 'pending') return
    if (!confirm(`Anfrage von ${req.name} (${req.email}) ablehnen?`)) return
    setBusy(req.id)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: user?.id ?? null,
        })
        .eq('id', req.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const pending = list.filter((r) => r.status === 'pending')
  const processed = list.filter((r) => r.status !== 'pending')

  return (
    <AppShell
      pageEyebrow="Zugangs-Anfragen"
      pageTitle={
        <>
          Eingegangene <span className="heading-accent">Anfragen</span>
        </>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : list.length === 0 ? (
        <div className="glass-card-lg p-12 text-center">
          <h3 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Anfragen</span>
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Sobald jemand auf der Signup-Seite Zugang anfragt, erscheint die Anfrage hier.
          </p>
        </div>
      ) : (
        <>
          {/* Pending */}
          <section>
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-ink-muted">
              Offen ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <div className="glass-card p-6 text-center text-sm text-ink-muted">
                Aktuell keine offenen Anfragen.
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {pending.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-2xl glass p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold tracking-tight text-ink">{r.name}</p>
                          <p className="mt-0.5 text-sm text-ink-muted">{r.email}</p>
                          {r.message && (
                            <p className="mt-3 rounded-xl bg-white/40 p-3 text-sm leading-relaxed text-ink-soft">
                              "{r.message}"
                            </p>
                          )}
                          <p className="mt-2 text-xs text-ink-dim">
                            Eingereicht{' '}
                            {new Date(r.created_at).toLocaleString('de-DE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => handleReject(r)}
                            disabled={busy === r.id}
                            className="btn-ghost text-sm"
                          >
                            Ablehnen
                          </button>
                          <button
                            onClick={() => handleApprove(r)}
                            disabled={busy === r.id}
                            className="btn-primary text-sm"
                          >
                            {busy === r.id ? '…' : 'Genehmigen & Einladen'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Processed */}
          {processed.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-ink-muted">
                Bearbeitet ({processed.length})
              </h2>
              <div className="glass-card overflow-hidden divide-y divide-white/40">
                {processed.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.name}</p>
                      <p className="truncate text-xs text-ink-muted">{r.email}</p>
                    </div>
                    {r.status === 'approved' ? (
                      <span className="pill-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Eingeladen
                      </span>
                    ) : (
                      <span className="pill-neutral">Abgelehnt</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
