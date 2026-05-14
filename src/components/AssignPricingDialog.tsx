import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import { adminAssignPricing } from '../lib/api'
import type { PricingPlan } from '../types/db'

type Props = {
  open: boolean
  voiceAgentId: string
  voiceAgentName: string
  onClose: () => void
  onAssigned: () => void
}

function formatPrice(cents: number | null, currency: string) {
  if (cents == null) return '—'
  return `${(cents / 100).toFixed(2)} ${currency}`
}

function summary(p: PricingPlan): string {
  if (p.type === 'hybrid') {
    return `${formatPrice(p.flat_amount_cents, p.currency)}/Mo + ${p.included_minutes} Min frei + ${p.per_minute_overage_cents}ct/Min`
  }
  if (p.type === 'per_minute') return `${p.per_minute_overage_cents}ct/Min`
  if (p.type === 'one_time') return `${formatPrice(p.flat_amount_cents, p.currency)} einmalig`
  return p.type
}

function typeBadge(type: string): { label: string; cls: string } {
  if (type === 'hybrid') return { label: 'Grundabo + Nutzung', cls: 'bg-slate-100 text-slate-700' }
  if (type === 'per_minute') return { label: 'Pro Minute', cls: 'bg-slate-100 text-slate-700' }
  if (type === 'one_time') return { label: 'Einmalig (sofort belastet)', cls: 'bg-amber-100 text-amber-800' }
  return { label: type, cls: 'bg-slate-100 text-slate-700' }
}

export function AssignPricingDialog({ open, voiceAgentId, voiceAgentName, onClose, onAssigned }: Props) {
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [selected, setSelected] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    supabase
      .from('pricing_plans')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPlans(data as PricingPlan[])
      })
  }, [open])

  const handleClose = () => {
    setSelected('')
    setStatus('idle')
    setError('')
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setStatus('loading')
    setError('')
    try {
      await adminAssignPricing({ voice_agent_id: voiceAgentId, pricing_plan_id: selected })
      onAssigned()
      handleClose()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/50" onClick={handleClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Pricing-Paket zuweisen</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Startet eine Stripe-Subscription für <strong>{voiceAgentName}</strong>.
                  </p>
                </div>

                {plans.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Keine Pricing-Pakete vorhanden. Leg zuerst eines unter <strong>Pricing-Pakete</strong> an.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plans.map((p) => {
                      const badge = typeBadge(p.type)
                      return (
                        <label
                          key={p.id}
                          className={`flex cursor-pointer items-start rounded-lg border p-3 transition-colors ${
                            selected === p.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="plan"
                            checked={selected === p.id}
                            onChange={() => setSelected(p.id)}
                            className="mt-0.5"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium">{p.name}</div>
                              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">{summary(p)}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}

                {selected && plans.find((p) => p.id === selected)?.type === 'one_time' && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    ⚠️ Einmal-Charges werden <strong>sofort</strong> belastet (nicht am Periodenende).
                    Stripe rechnet die Rechnung direkt über die hinterlegte Zahlungsmethode ab.
                  </div>
                )}

                {status === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={handleClose} className="btn-ghost flex-1"
                    disabled={status === 'loading'}>Abbrechen</button>
                  <button type="submit" className="btn-primary flex-1"
                    disabled={status === 'loading' || !selected}>
                    {status === 'loading'
                      ? 'Starte…'
                      : plans.find((p) => p.id === selected)?.type === 'one_time'
                      ? 'Einmal-Charge auslösen'
                      : 'Subscription starten'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
