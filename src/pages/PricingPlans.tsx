import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { PricingPlan } from '../types/db'
import { NewPricingPlanDialog } from '../components/NewPricingPlanDialog'

function formatPrice(cents: number | null, currency: string) {
  if (cents == null) return '—'
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function planSummary(plan: PricingPlan): string {
  if (plan.type === 'hybrid') {
    return `${formatPrice(plan.flat_amount_cents, plan.currency)}/${plan.billing_interval === 'year' ? 'Jahr' : 'Monat'} + ${plan.included_minutes} Min frei + ${plan.per_minute_overage_cents}ct/Min danach`
  }
  if (plan.type === 'per_minute') {
    return `${plan.per_minute_overage_cents}ct/Min, monatlich summiert`
  }
  if (plan.type === 'flat') {
    return `${formatPrice(plan.flat_amount_cents, plan.currency)}/${plan.billing_interval === 'year' ? 'Jahr' : 'Monat'} flat`
  }
  if (plan.type === 'one_time') {
    return `${formatPrice(plan.flat_amount_cents, plan.currency)} einmalig`
  }
  return plan.type
}

function typeLabel(type: string): string {
  switch (type) {
    case 'hybrid':
      return 'Grundabo + Nutzung'
    case 'per_minute':
      return 'Pro Minute'
    case 'one_time':
      return 'Einmalig'
    case 'flat':
      return 'Flat Abo'
    default:
      return type
  }
}

export function PricingPlans() {
  const { user, signOut } = useAuth()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
    if (!error && data) setPlans(data as PricingPlan[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-lg font-semibold">
              AleksaAI Admin
            </Link>
            <nav className="flex gap-1">
              <Link to="/admin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Kunden</Link>
              <Link to="/admin/agents" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Agenten</Link>
              <Link to="/admin/integrations" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Integrationen</Link>
              <Link to="/admin/pricing-plans" className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900">Pricing-Pakete</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={signOut} className="btn-ghost text-sm">
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Pricing-Pakete</h2>
            <p className="mt-1 text-sm text-slate-500">
              {plans.length === 0
                ? 'Noch keine Pakete. Leg dein erstes an.'
                : `${plans.length} aktive ${plans.length === 1 ? 'Paket' : 'Pakete'}.`}
            </p>
          </div>
          <button onClick={() => setDialogOpen(true)} className="btn-primary">
            + Neues Paket
          </button>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade…</div>
        ) : plans.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card text-center"
          >
            <h3 className="text-base font-medium">Noch leer hier</h3>
            <p className="mt-1 text-sm text-slate-500">
              Pricing-Pakete bestimmen wie deine Customers für Voice-Agent-Nutzung bezahlen.
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {typeLabel(p.type)}
                  </span>
                  <span className="text-xs text-slate-400">{p.currency}</span>
                </div>
                <h3 className="text-base font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{planSummary(p)}</p>
                <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  Stripe: <code className="text-slate-500">{p.stripe_product_id?.slice(0, 18)}…</code>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <NewPricingPlanDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
      />
    </div>
  )
}
