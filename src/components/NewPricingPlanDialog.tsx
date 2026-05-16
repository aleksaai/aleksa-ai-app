import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { adminCreatePricingPlan, agencyCreatePricingPlan, type PricingPlanInput } from '../lib/api'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
  // 'admin' (default) uses the platform Stripe account; 'agency' routes
  // through the partner's connected account.
  scope?: 'admin' | 'agency'
}

type Mode = 'hybrid' | 'per_minute' | 'one_time'

const MODE_LABELS: Record<Mode, string> = {
  hybrid: 'Grundabo + Nutzung',
  per_minute: 'Nur nutzungsbasiert',
  one_time: 'Einmalig',
}

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  hybrid: 'Fixe monatliche Gebühr + N Min inklusive + pro Min danach',
  per_minute: 'Nur pro Minute, monatlich summiert + abgerechnet',
  one_time: 'Einmal-Charge — kein Abo',
}

export function NewPricingPlanDialog({ open, onClose, onCreated, scope = 'admin' }: Props) {
  const [mode, setMode] = useState<Mode>('hybrid')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')
  const [flatEur, setFlatEur] = useState('')
  const [includedMin, setIncludedMin] = useState('')
  const [perMinCents, setPerMinCents] = useState('')

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const reset = () => {
    setMode('hybrid')
    setName('')
    setCurrency('EUR')
    setBillingInterval('month')
    setFlatEur('')
    setIncludedMin('')
    setPerMinCents('')
    setStatus('idle')
    setError('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError('')

    try {
      let input: PricingPlanInput
      const flatCents = flatEur ? Math.round(parseFloat(flatEur) * 100) : undefined
      const overageCents = perMinCents ? parseInt(perMinCents, 10) : undefined
      const included = includedMin ? parseInt(includedMin, 10) : undefined

      if (mode === 'hybrid') {
        if (!flatCents || !included || !overageCents) {
          throw new Error('Bitte alle Felder ausfüllen.')
        }
        input = {
          type: 'hybrid',
          name,
          currency,
          billing_interval: billingInterval,
          flat_amount_cents: flatCents,
          included_minutes: included,
          per_minute_overage_cents: overageCents,
        }
      } else if (mode === 'per_minute') {
        if (!overageCents) throw new Error('Bitte Cent pro Minute angeben.')
        input = {
          type: 'per_minute',
          name,
          currency,
          billing_interval: billingInterval,
          per_minute_overage_cents: overageCents,
        }
      } else {
        if (!flatCents) throw new Error('Bitte Betrag in Euro angeben.')
        input = {
          type: 'one_time',
          name,
          currency,
          flat_amount_cents: flatCents,
        }
      }

      if (scope === 'agency') {
        await agencyCreatePricingPlan(input)
      } else {
        await adminCreatePricingPlan(input)
      }
      setStatus('success')
      onCreated()
      setTimeout(handleClose, 800)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-md"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <div
              className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Neues Pricing-Paket</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Wird automatisch als Stripe Product + Price angelegt.
                  </p>
                </div>

                {/* Mode Selector */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Modell</label>
                  <div className="space-y-2">
                    {(['hybrid', 'per_minute', 'one_time'] as Mode[]).map((m) => (
                      <label
                        key={m}
                        className={`flex cursor-pointer items-start rounded-lg border p-3 transition-colors ${
                          mode === m
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === m}
                          onChange={() => setMode(m)}
                          className="mt-0.5"
                        />
                        <div className="ml-3">
                          <div className="text-sm font-medium">{MODE_LABELS[m]}</div>
                          <div className="text-xs text-slate-500">{MODE_DESCRIPTIONS[m]}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="plan-name" className="mb-1 block text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    id="plan-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Standard 200€/Monat"
                    className="input"
                  />
                </div>

                {/* Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="currency" className="mb-1 block text-sm font-medium text-slate-700">
                      Währung
                    </label>
                    <select
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="input"
                    >
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                  {mode !== 'one_time' && (
                    <div>
                      <label htmlFor="interval" className="mb-1 block text-sm font-medium text-slate-700">
                        Abrechnung
                      </label>
                      <select
                        id="interval"
                        value={billingInterval}
                        onChange={(e) => setBillingInterval(e.target.value as 'month' | 'year')}
                        className="input"
                      >
                        <option value="month">Monatlich</option>
                        <option value="year">Jährlich</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Mode-specific fields */}
                {mode === 'hybrid' && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Grundgebühr ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={flatEur}
                        onChange={(e) => setFlatEur(e.target.value)}
                        placeholder="200"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Inklusive Minuten
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={includedMin}
                        onChange={(e) => setIncludedMin(e.target.value)}
                        placeholder="100"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Cent pro Min danach
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={perMinCents}
                        onChange={(e) => setPerMinCents(e.target.value)}
                        placeholder="30"
                        className="input"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        z.B. <code>30</code> = 30 Cent pro überzähliger Minute
                      </p>
                    </div>
                  </div>
                )}

                {mode === 'per_minute' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Cent pro Minute
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={perMinCents}
                      onChange={(e) => setPerMinCents(e.target.value)}
                      placeholder="18"
                      className="input"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      z.B. <code>18</code> = 18 Cent pro Minute, monatlich gesammelt + abgerechnet
                    </p>
                  </div>
                )}

                {mode === 'one_time' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Einmal-Betrag ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={flatEur}
                      onChange={(e) => setFlatEur(e.target.value)}
                      placeholder="300"
                      className="input"
                    />
                  </div>
                )}

                {status === 'error' && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {status === 'success' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    ✓ Paket angelegt, wird gleich in der Liste sichtbar.
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-ghost flex-1"
                    disabled={status === 'loading'}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={status === 'loading' || !name}
                  >
                    {status === 'loading' ? 'Lege an…' : 'Erstellen'}
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
