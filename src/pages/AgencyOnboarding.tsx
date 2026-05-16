// /agency-onboarding — multi-step wizard for new partners.
// Reached via magic-link after an admin approves an access_request.
// Steps: 1) Slug, 2) Branding (display_name + color), 3) Confirm → finalize.
// After finalize the partner is redirected to their tenant subdomain.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { agencyFinalizeOnboarding } from '../lib/api'
import { AuthShell } from '../components/AuthShell'

type Step = 'slug' | 'branding' | 'confirm' | 'done'

export function AgencyOnboarding() {
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get('request_id') ?? undefined

  const [step, setStep] = useState<Step>('slug')
  const [slug, setSlug] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [brandColor, setBrandColor] = useState('#66A4FF')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // If the user already has an agency, send them home.
  useEffect(() => {
    if (authLoading) return
    if (profile?.role === 'agency_owner' && profile.agency_id) {
      navigate('/agency', { replace: true })
    }
  }, [authLoading, profile, navigate])

  // Slug availability check (debounced)
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugStatus('idle')
      return
    }
    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('check_slug_availability', { p_slug: slug })
      if (error) setSlugStatus('idle')
      else setSlugStatus(data ? 'free' : 'taken')
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  const handleNextSlug = (e: FormEvent) => {
    e.preventDefault()
    if (slugStatus !== 'free') return
    // Pre-fill displayName with a title-cased slug if empty
    if (!displayName) {
      setDisplayName(slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    }
    setStep('branding')
  }

  const handleNextBranding = (e: FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return
    setStep('confirm')
  }

  const handleFinalize = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await agencyFinalizeOnboarding({
        request_id: requestId,
        slug,
        display_name: displayName,
        brand_color: brandColor,
      })
      setStep('done')
      const targetUrl = `https://${result.agency.slug}.openpenguin.de/agency`
      setTimeout(() => { window.location.href = targetUrl }, 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (authLoading) {
    return (
      <AuthShell>
        <div className="text-center text-sm text-ink-muted">Lade…</div>
      </AuthShell>
    )
  }

  if (!user) {
    return (
      <AuthShell>
        <div className="text-center text-sm text-ink-muted">
          Bitte über den Magic-Link aus deiner Email einsteigen.
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div>
          <p className="eyebrow mb-1.5">Partner-Setup · {stepLabel(step)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dein eigenes <span className="heading-accent">Whitelabel</span>
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Wir richten in 2 Minuten deine eigene Voice-Agent-Plattform unter <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">{slug || 'deinslug'}.openpenguin.de</code> ein.
          </p>
        </div>

        {step === 'slug' && (
          <form onSubmit={handleNextSlug} className="space-y-4">
            <div>
              <label htmlFor="slug" className="label-soft mb-2 block">Wähle deine Subdomain</label>
              <div className="glass-input flex items-center">
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="stephan"
                  className="flex-1 bg-transparent outline-none"
                  minLength={3}
                  maxLength={20}
                  autoFocus
                  required
                />
                <span className="ml-2 text-sm text-ink-muted">.openpenguin.de</span>
              </div>
              <p className="mt-1.5 text-xs">
                {slugStatus === 'checking' && <span className="text-ink-muted">Prüfe…</span>}
                {slugStatus === 'free' && <span className="text-emerald-700">✓ verfügbar</span>}
                {slugStatus === 'taken' && <span className="text-red-700">— bereits vergeben oder reserviert</span>}
                {slugStatus === 'idle' && <span className="text-ink-muted">3–20 Zeichen · lowercase a–z, Ziffern, Bindestrich</span>}
              </p>
            </div>
            <button type="submit" disabled={slugStatus !== 'free'} className="btn-primary w-full">Weiter →</button>
          </form>
        )}

        {step === 'branding' && (
          <form onSubmit={handleNextBranding} className="space-y-4">
            <div>
              <label htmlFor="display_name" className="label-soft mb-2 block">Anzeigename</label>
              <input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Stephan Voice"
                className="glass-input"
                required
                maxLength={60}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                So heißt deine Plattform in der Navigation + auf der Login-Seite.
              </p>
            </div>
            <div>
              <label htmlFor="brand_color" className="label-soft mb-2 block">Brand-Farbe</label>
              <div className="flex items-center gap-3">
                <input
                  id="brand_color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent"
                />
                <code className="rounded bg-white/60 px-2 py-1 text-xs">{brandColor}</code>
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                Buttons, Links und Akzente auf deiner Plattform übernehmen diese Farbe.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep('slug')} className="btn-ghost flex-1">Zurück</button>
              <button type="submit" className="btn-primary flex-1">Weiter →</button>
            </div>
          </form>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-3">
              <Row label="Plattform-URL" value={`https://${slug}.openpenguin.de`} />
              <Row label="Anzeigename" value={displayName} />
              <Row label="Brand-Farbe" value={brandColor}>
                <div className="h-5 w-5 rounded-md border border-white/60" style={{ background: brandColor }} />
              </Row>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep('branding')} disabled={busy} className="btn-ghost flex-1">Zurück</button>
              <button onClick={handleFinalize} disabled={busy} className="btn-primary flex-1">
                {busy ? 'Erstelle…' : 'Konto einrichten'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              <span className="heading-accent">Fertig!</span>
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Deine Plattform läuft jetzt auf <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">{slug}.openpenguin.de</code>. Wir leiten dich weiter…
            </p>
          </motion.div>
        )}
      </motion.div>
    </AuthShell>
  )
}

function stepLabel(step: Step): string {
  switch (step) {
    case 'slug': return 'Schritt 1 von 3'
    case 'branding': return 'Schritt 2 von 3'
    case 'confirm': return 'Schritt 3 von 3'
    case 'done': return 'Fertig'
  }
}

function Row({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="label-soft mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        {children}
        <p className="text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  )
}
