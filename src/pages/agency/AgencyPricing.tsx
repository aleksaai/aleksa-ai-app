// /agency/pricing — Partner-side pricing plan management.
// Mirrors the master PricingPlans page but routes creation through the partner's
// connected Stripe account (see agency-create-pricing-plan). Hard-gated on the
// agency having an active Stripe Connect link; without one we show a CTA back
// to settings instead of the create dialog (Stripe would reject anyway).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AgencyShell } from '../../components/AgencyShell'
import { NewPricingPlanDialog } from '../../components/NewPricingPlanDialog'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { PricingPlan } from '../../types/db'

type AgencyStripeStatus = {
  status: string | null
  account_id: string | null
}

function formatPrice(cents: number | null, currency: string) {
  if (cents == null) return '—'
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function planSummary(plan: PricingPlan): string {
  if (plan.type === 'hybrid') {
    return `${formatPrice(plan.flat_amount_cents, plan.currency)}/${plan.billing_interval === 'year' ? 'Jahr' : 'Monat'} + ${plan.included_minutes} Min frei + ${plan.per_minute_overage_cents}ct/Min danach`
  }
  if (plan.type === 'per_minute') return `${plan.per_minute_overage_cents}ct/Min, monatlich summiert`
  if (plan.type === 'flat')
    return `${formatPrice(plan.flat_amount_cents, plan.currency)}/${plan.billing_interval === 'year' ? 'Jahr' : 'Monat'} flat`
  if (plan.type === 'one_time') return `${formatPrice(plan.flat_amount_cents, plan.currency)} einmalig`
  return plan.type
}

function typeLabel(type: string): string {
  switch (type) {
    case 'hybrid': return 'Grundabo + Nutzung'
    case 'per_minute': return 'Pro Minute'
    case 'one_time': return 'Einmalig'
    case 'flat': return 'Flat Abo'
    default: return type
  }
}

export function AgencyPricing() {
  const { profile } = useAuth()
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [stripeStatus, setStripeStatus] = useState<AgencyStripeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    if (!profile?.agency_id) return
    setLoading(true)
    const [plansRes, agencyRes] = await Promise.all([
      supabase
        .from('pricing_plans')
        .select('*')
        .eq('archived', false)
        .eq('agency_id', profile.agency_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('agencies')
        .select('stripe_connect_status, stripe_connect_account_id')
        .eq('id', profile.agency_id)
        .maybeSingle(),
    ])
    if (plansRes.data) setPlans(plansRes.data as PricingPlan[])
    setStripeStatus({
      status: (agencyRes.data?.stripe_connect_status as string) ?? null,
      account_id: (agencyRes.data?.stripe_connect_account_id as string) ?? null,
    })
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.agency_id])

  const stripeReady = stripeStatus?.status === 'active' && !!stripeStatus.account_id

  return (
    <AgencyShell
      pageEyebrow="Pricing"
      pageTitle={<>Deine <span className="heading-accent">Pakete</span></>}
      pageAction={
        stripeReady ? (
          <button onClick={() => setDialogOpen(true)} className="btn-primary">
            <PlusIcon /> Neues Paket
          </button>
        ) : null
      }
    >
      {!stripeReady && !loading ? (
        <StripeRequiredCard />
      ) : loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : plans.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-lg p-12 text-center"
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.4) 100%)' }}
          >
            <TagIcon />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Pakete</span>
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Pricing-Pakete bestimmen, wie deine Kunden für Voice-Agent-Nutzung bezahlen.
            Produkte werden direkt auf deinem Stripe-Account angelegt.
          </p>
          <button onClick={() => setDialogOpen(true)} className="btn-primary mt-6">
            <PlusIcon /> Erstes Paket anlegen
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-2xl glass p-5"
            >
              <div className="flex items-center justify-between">
                <span className="pill-brand">{typeLabel(p.type)}</span>
                <span className="text-xs font-medium text-ink-dim">{p.currency}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{p.name}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{planSummary(p)}</p>

              {p.included_minutes != null && p.type === 'hybrid' && (
                <div className="mt-4 rounded-xl bg-white/50 p-3">
                  <p className="label-soft mb-1">Inklusive</p>
                  <p className="text-sm font-semibold text-ink">{p.included_minutes} Minuten</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <NewPricingPlanDialog
        scope="agency"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={load}
      />
    </AgencyShell>
  )
}

function StripeRequiredCard() {
  return (
    <div className="glass-card-lg p-10 text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.32) 100%)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">Stripe-Account erforderlich</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
        Pricing-Pakete werden auf deinem eigenen Stripe-Account angelegt. Verbinde zuerst dein Konto.
      </p>
      <Link to="/agency/settings" className="btn-primary mt-6 inline-flex">
        Zu den Einstellungen →
      </Link>
    </div>
  )
}

function TagIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-700)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41L13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
