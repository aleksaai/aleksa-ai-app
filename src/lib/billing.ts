// Cost calculation helpers for the Customer Dashboard.
// Mirror logic of how Stripe charges so the customer sees a live preview
// of what will be on the next invoice.

import type { PricingPlan } from '../types/db'

export function formatMoney(cents: number, currency: string): string {
  const major = (cents / 100).toFixed(2)
  return `${major} ${currency}`
}

export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs} Sek`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')} Min`
}

// Round up to whole minutes — Stripe usage_records are integer quantities.
export function ceilMinutes(secs: number): number {
  return Math.ceil(secs / 60)
}

// What the customer will be billed at end-of-period for the given calls.
// Returns total in cents.
export function projectedCostCents(plan: PricingPlan | null, totalCallSecs: number): number {
  if (!plan) return 0
  const minutes = ceilMinutes(totalCallSecs)

  if (plan.type === 'per_minute') {
    return minutes * (plan.per_minute_overage_cents ?? 0)
  }
  if (plan.type === 'hybrid') {
    const flat = plan.flat_amount_cents ?? 0
    const included = plan.included_minutes ?? 0
    const overageMin = Math.max(0, minutes - included)
    const overageCost = overageMin * (plan.per_minute_overage_cents ?? 0)
    return flat + overageCost
  }
  if (plan.type === 'flat') {
    return plan.flat_amount_cents ?? 0
  }
  if (plan.type === 'one_time') {
    // One-time is charged immediately at assignment, not at period-end
    return plan.flat_amount_cents ?? 0
  }
  return 0
}

export function costPerMinuteLabel(plan: PricingPlan | null): string {
  if (!plan) return '—'
  if (plan.type === 'per_minute') {
    return `${plan.per_minute_overage_cents} ct/Min`
  }
  if (plan.type === 'hybrid') {
    return `${formatMoney(plan.flat_amount_cents ?? 0, plan.currency)}/Mo + ${plan.included_minutes} Min frei + ${plan.per_minute_overage_cents}ct/Min`
  }
  if (plan.type === 'flat') {
    return `${formatMoney(plan.flat_amount_cents ?? 0, plan.currency)}/Mo`
  }
  if (plan.type === 'one_time') {
    return `${formatMoney(plan.flat_amount_cents ?? 0, plan.currency)} einmalig`
  }
  return ''
}

export function periodLabel(start: string | null, end: string | null): string {
  if (!start || !end) return '—'
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
  return `${s.toLocaleDateString('de-DE', opts)} – ${e.toLocaleDateString('de-DE', opts)}`
}
