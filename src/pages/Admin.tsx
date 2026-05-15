import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types/db'
import { NewCustomerDialog } from '../components/NewCustomerDialog'
import { AppShell } from '../components/AppShell'

// A/B-test: blue accent (#65A4FF) only on this overview page.
// Other admin pages stay on the default lavender for direct comparison.
function useBlueAccent() {
  useEffect(() => {
    document.body.classList.add('theme-blue')
    return () => document.body.classList.remove('theme-blue')
  }, [])
}

type Kpi = {
  customers: number
  agents: number
  activeSubs: number
  pendingOnboarding: number
}

export function Admin() {
  useBlueAccent()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [kpi, setKpi] = useState<Kpi>({ customers: 0, agents: 0, activeSubs: 0, pendingOnboarding: 0 })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    const [{ data: cs }, { count: agentCount }, { count: subCount }] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('voice_agents').select('*', { count: 'exact', head: true }),
      supabase.from('customer_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ])
    const list = (cs as Customer[]) ?? []
    setCustomers(list)
    setKpi({
      customers: list.length,
      agents: agentCount ?? 0,
      activeSubs: subCount ?? 0,
      pendingOnboarding: list.filter((c) => !c.has_payment_method).length,
    })
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  return (
    <AppShell
      pageEyebrow="Übersicht"
      pageTitle={
        <>
          Willkommen <span className="heading-accent">zurück</span>
        </>
      }
      pageAction={
        <button onClick={() => setDialogOpen(true)} className="btn-primary">
          <PlusIcon /> Neuer Kunde
        </button>
      }
    >
      {/* ============ KPI ROW ============ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Kunden"
          value={kpi.customers}
          hint={`${kpi.pendingOnboarding} im Onboarding`}
          accent
        />
        <KpiCard label="Voice-Agenten" value={kpi.agents} hint="Live + im Setup" />
        <KpiCard label="Aktive Abos" value={kpi.activeSubs} hint="Stripe-Subscriptions" />
        <KpiCard
          label="Onboarding offen"
          value={kpi.pendingOnboarding}
          hint={kpi.pendingOnboarding > 0 ? 'Brauchen Zahlungsmethode' : 'Alle aktiv'}
          warn={kpi.pendingOnboarding > 0}
        />
      </div>

      {/* ============ CUSTOMERS LIST ============ */}
      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1">Kundenliste</p>
            <h2 className="text-xl font-semibold tracking-tight">
              Alle <span className="heading-accent">Kunden</span>
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
        ) : customers.length === 0 ? (
          <EmptyState onCreate={() => setDialogOpen(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {customers.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
      </section>

      <NewCustomerDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={loadAll} />
    </AppShell>
  )
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  warn,
}: {
  label: string
  value: number | string
  hint?: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass p-5">
      {accent && (
        <div
          aria-hidden
          className="absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-30 blur-2xl"
          style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
        />
      )}
      <p className="label-soft">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && (
        <p className={`mt-1.5 text-xs ${warn ? 'text-amber-700' : 'text-ink-muted'}`}>{hint}</p>
      )}
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
