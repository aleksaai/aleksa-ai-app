import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types/db'
import { NewCustomerDialog } from '../components/NewCustomerDialog'
import { AppShell } from '../components/AppShell'

export function Admin() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState('')

  const loadAll = async () => {
    setLoading(true)
    // Only show real voice-agent customers — platform members (community signups)
    // live in /admin/requests, not here.
    // Platform admin sees ONLY master customers (agency_id IS NULL). Partner
    // customers are accessible per-agency via /platform-admin/agencies — never
    // mixed into the master overview. RLS still allows admin to read them all
    // (needed for cross-tenant support), so the filter happens here.
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_kind', 'voice_customer')
      .is('agency_id', null)
      .order('created_at', { ascending: false })
    setCustomers((data ?? []) as Customer[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase().trim()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.contact_email.toLowerCase().includes(q),
    )
  }, [customers, search])

  return (
    <AppShell
      pageEyebrow="Übersicht"
      pageTitle={
        <>
          Deine <span className="heading-accent">Kunden</span>
        </>
      }
      pageAction={
        <button onClick={() => setDialogOpen(true)} className="btn-primary">
          <PlusIcon /> Neuer Kunde
        </button>
      }
    >
      {/* ============ SEARCH ============ */}
      <div className="mb-6">
        <SearchBar value={search} onChange={setSearch} count={filtered.length} total={customers.length} />
      </div>

      {/* ============ CUSTOMERS LIST ============ */}
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : customers.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">
          Keine Kunden gefunden für "<strong className="text-ink">{search}</strong>".
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              onClick={() => navigate(`/admin/customers/${c.id}`)}
              className="group relative overflow-hidden rounded-2xl glass p-5 text-left transition-all hover:shadow-glass-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div>
                    <p className="font-semibold tracking-tight text-ink">{c.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{c.contact_email}</p>
                  </div>
                </div>
                <StatusPill ok={c.has_payment_method} />
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/40 pt-3 text-xs text-ink-muted">
                <span>
                  Seit{' '}
                  {new Date(c.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span
                  className="font-medium opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--accent-700)' }}
                >
                  Öffnen →
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <NewCustomerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={loadAll} />
    </AppShell>
  )
}

function SearchBar({
  value,
  onChange,
  count,
  total,
}: {
  value: string
  onChange: (v: string) => void
  count: number
  total: number
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Kunden suchen…"
        className="glass-input w-full pl-12 pr-32"
        style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-ink-muted">
        {value.trim() ? (
          <span>
            {count} von {total}
          </span>
        ) : (
          <span>
            {total} {total === 1 ? 'Kunde' : 'Kunden'}
          </span>
        )}
      </div>
    </div>
  )
}

function StatusPill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="pill-success">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Aktiv
    </span>
  ) : (
    <span className="pill-warn">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Onboarding
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
      style={{
        background:
          'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 4px 14px -4px rgba(var(--accent-shadow-rgb),0.45)',
      }}
    >
      {initials}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card-lg p-12 text-center"
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.4) 100%)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-700)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">
        Noch <span className="heading-accent">keine Kunden</span>
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
        Leg deinen ersten Kunden an. Du kannst danach Voice-Agenten zuweisen und Pricing-Pakete verknüpfen.
      </p>
      <button onClick={onCreate} className="btn-primary mt-6">
        <PlusIcon /> Ersten Kunden anlegen
      </button>
    </motion.div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
