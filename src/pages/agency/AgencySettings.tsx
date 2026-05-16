// /agency/settings — agency settings hub with sub-tabs.
// Tabs: Whitelabel (brand/logo), Domain (subdomain + custom), Payments (Stripe Connect).
// Phase C: tab structure + read-only displays. Phase F wires whitelabel editor,
// Phase G wires Stripe Connect button, Phase H wires custom-domain verification.

import { useEffect, useState } from 'react'
import { AgencyShell } from '../../components/AgencyShell'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Agency } from '../../types/db'

// Phase F: AgencySettings has editable Whitelabel tab now.
// Domain + Payments tabs remain placeholder until Phase H + G land.

type Tab = 'whitelabel' | 'domain' | 'payments'

export function AgencySettings() {
  const { profile } = useAuth()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('whitelabel')

  useEffect(() => {
    if (!profile?.agency_id) return
    void supabase
      .from('agencies')
      .select('*')
      .eq('id', profile.agency_id)
      .maybeSingle()
      .then(({ data }) => {
        setAgency(data as Agency | null)
        setLoading(false)
      })
  }, [profile?.agency_id])

  if (loading) {
    return (
      <AgencyShell pageEyebrow="Einstellungen" pageTitle="Einstellungen">
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      </AgencyShell>
    )
  }

  if (!agency) {
    return (
      <AgencyShell pageEyebrow="Einstellungen" pageTitle="Einstellungen">
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          Agency nicht gefunden. Bist du sicher angemeldet als Partner?
        </div>
      </AgencyShell>
    )
  }

  return (
    <AgencyShell pageEyebrow="Einstellungen" pageTitle="Einstellungen">
      <div className="mb-6 tab-pill-group">
        <TabButton current={tab} value="whitelabel" onClick={setTab} label="Whitelabel" />
        <TabButton current={tab} value="domain" onClick={setTab} label="Domain" />
        <TabButton current={tab} value="payments" onClick={setTab} label="Zahlungen" />
      </div>

      {tab === 'whitelabel' && <WhitelabelTab agency={agency} onUpdated={setAgency} />}
      {tab === 'domain' && <DomainTab agency={agency} onUpdated={setAgency} />}
      {tab === 'payments' && <PaymentsTab agency={agency} onUpdated={setAgency} />}
    </AgencyShell>
  )
}

function TabButton<T extends string>({
  current,
  value,
  onClick,
  label,
}: {
  current: T
  value: T
  onClick: (v: T) => void
  label: string
}) {
  const active = current === value
  return (
    <button onClick={() => onClick(value)} className={`tab-pill ${active ? 'tab-pill-active' : ''}`}>
      {label}
    </button>
  )
}

// ─── Whitelabel tab — editable (Phase F) ────────────────────────────────
function WhitelabelTab({ agency, onUpdated }: { agency: Agency; onUpdated: (a: Agency) => void }) {
  const [displayName, setDisplayName] = useState(agency.display_name)
  const [brandColor, setBrandColor] = useState(agency.brand_color)
  const [logoUrl, setLogoUrl] = useState<string | null>(agency.logo_url)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const hasChanges =
    displayName !== agency.display_name ||
    brandColor !== agency.brand_color ||
    logoUrl !== agency.logo_url

  const handleLogoUpload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      // Path scheme: {agency_id}/logo-{timestamp}.{ext} (cache-busting via filename)
      const path = `${agency.id}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('agency-branding')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = supabase.storage.from('agency-branding').getPublicUrl(path)
      setLogoUrl(pub.publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
        throw new Error('Brand-Farbe muss 6-stelliger Hex sein, z.B. #66A4FF')
      }
      const { data, error } = await supabase
        .from('agencies')
        .update({
          display_name: displayName.trim(),
          brand_color: brandColor,
          logo_url: logoUrl,
        })
        .eq('id', agency.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      onUpdated(data as Agency)
      setSaved(true)
      // Reload so TenantProvider re-applies the new palette + new logo/title
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-card-lg p-7">
      <p className="eyebrow mb-2">Branding</p>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Whitelabel-Einstellungen</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        So sieht deine Plattform aus für deine Kunden. Änderungen sind nach dem Speichern sofort live.
      </p>

      <div className="mt-6 space-y-5">
        {/* Read-only: slug */}
        <Field label="Slug (Subdomain)" value={`${agency.slug}.openpenguin.de`} />

        {/* Editable: display name */}
        <div>
          <label htmlFor="display_name" className="label-soft mb-1.5 block">Anzeigename</label>
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="glass-input"
            maxLength={60}
            disabled={busy}
          />
        </div>

        {/* Editable: brand color */}
        <div>
          <label htmlFor="brand_color_input" className="label-soft mb-1.5 block">Brand-Farbe</label>
          <div className="flex items-center gap-3">
            <input
              id="brand_color_input"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent"
              disabled={busy}
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="glass-input flex-1 font-mono"
              maxLength={7}
              disabled={busy}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            Buttons, Links und Akzente übernehmen diese Farbe (Palette wird automatisch generiert).
          </p>
        </div>

        {/* Editable: logo */}
        <div>
          <label className="label-soft mb-1.5 block">Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-xl border border-white/60 bg-white/30 p-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo Preview" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-ink-dim">kein Logo</div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleLogoUpload(file)
                }}
                disabled={uploading || busy}
                className="text-sm"
              />
              {uploading && <p className="text-xs text-ink-muted">Lade hoch…</p>}
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="text-xs text-ink-muted underline hover:text-red-600"
                >
                  Logo entfernen
                </button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            PNG, JPG, SVG oder WebP, max 5 MB. Wird als 11×11 Icon in Navigation + Auth-Card gezeigt.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-700">
          ✓ Gespeichert — lade gleich neu mit deinem neuen Branding…
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          onClick={handleSave}
          disabled={busy || uploading || !hasChanges}
          className="btn-primary"
        >
          {busy ? 'Speichere…' : 'Speichern'}
        </button>
        {hasChanges && (
          <button
            onClick={() => {
              setDisplayName(agency.display_name)
              setBrandColor(agency.brand_color)
              setLogoUrl(agency.logo_url)
              setError(null)
            }}
            disabled={busy}
            className="btn-ghost"
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Domain tab — Phase H: editable custom domain + DNS verification ───
function DomainTab({ agency, onUpdated }: { agency: Agency; onUpdated: (a: Agency) => void }) {
  const [domain, setDomain] = useState(agency.custom_domain ?? '')
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  const saveDomain = async () => {
    setBusy(true)
    setError(null)
    setVerifyResult(null)
    try {
      const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      if (cleaned && !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(cleaned)) {
        throw new Error('Bitte gib eine gültige Domain ein (z.B. app.kihelden.de)')
      }
      const { data, error } = await supabase
        .from('agencies')
        .update({
          custom_domain: cleaned || null,
          custom_domain_status: cleaned ? 'pending_dns' : 'none',
          custom_domain_verified_at: null,
        })
        .eq('id', agency.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      onUpdated(data as Agency)
      setDomain(cleaned)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const verifyDomain = async () => {
    setVerifying(true)
    setError(null)
    setVerifyResult(null)
    try {
      const { verifyCustomDomain } = await import('../../lib/api')
      const r = await verifyCustomDomain()
      if (r.ok) {
        setVerifyResult(r.note ?? 'DNS verifiziert.')
        // Reload to get fresh agency
        const { data } = await supabase.from('agencies').select('*').eq('id', agency.id).maybeSingle()
        if (data) onUpdated(data as Agency)
      } else {
        setError(r.detail ?? r.error ?? 'Verifizierung fehlgeschlagen.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setVerifying(false)
    }
  }

  const cnameTarget = `${agency.slug}.openpenguin.de`

  return (
    <div className="glass-card-lg p-7">
      <p className="eyebrow mb-2">Domain</p>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Eigene Domain</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        Deine Plattform läuft automatisch unter{' '}
        <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">{cnameTarget}</code>.
        Optional kannst du eine eigene Domain einrichten (z.B.{' '}
        <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">app.deine-firma.de</code>).
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="custom_domain" className="label-soft mb-1.5 block">Eigene Domain</label>
          <input
            id="custom_domain"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="app.deine-firma.de"
            className="glass-input"
            disabled={busy}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Volle Subdomain ohne https://, z.B. <code>app.kihelden.de</code>.
          </p>
        </div>

        {agency.custom_domain && (
          <>
            <div>
              <p className="label-soft mb-1.5">Status</p>
              <div className="flex items-center gap-3">
                {agency.custom_domain_status === 'verified' && (
                  <span className="pill-success">✓ Verifiziert</span>
                )}
                {agency.custom_domain_status === 'pending_dns' && (
                  <span className="pill-warn">DNS-Prüfung ausstehend</span>
                )}
                {agency.custom_domain_status === 'failed' && (
                  <span className="pill-neutral" style={{ background: 'rgba(239,68,68,0.12)', color: '#b91c1c', borderColor: 'rgba(239,68,68,0.25)' }}>
                    Verifizierung fehlgeschlagen
                  </span>
                )}
                {agency.custom_domain_verified_at && (
                  <span className="text-xs text-ink-muted">
                    seit {new Date(agency.custom_domain_verified_at).toLocaleDateString('de-DE')}
                  </span>
                )}
              </div>
            </div>

            {agency.custom_domain_status !== 'verified' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900">
                <p className="font-semibold mb-2">DNS-Setup bei deinem Registrar:</p>
                <p className="mb-2">
                  Lege einen CNAME-Record an:
                </p>
                <pre className="overflow-x-auto rounded bg-white/70 p-2 text-[11px] font-mono">
{`Type:   CNAME
Name:   ${agency.custom_domain.split('.')[0]}
Value:  ${cnameTarget}`}
                </pre>
                <p className="mt-2">
                  DNS-Propagation kann 5–60 Minuten dauern. Danach unten auf "Verifizieren" klicken.
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {verifyResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-700">
            ✓ {verifyResult}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={saveDomain}
            disabled={busy || verifying || domain === (agency.custom_domain ?? '')}
            className="btn-primary"
          >
            {busy ? 'Speichere…' : agency.custom_domain ? 'Domain aktualisieren' : 'Domain hinzufügen'}
          </button>
          {agency.custom_domain && agency.custom_domain_status !== 'verified' && (
            <button
              onClick={verifyDomain}
              disabled={busy || verifying}
              className="btn-ghost"
            >
              {verifying ? 'Prüfe DNS…' : 'Verifizieren'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Payments tab — Phase G: Stripe Connect OAuth flow ────────────────
function PaymentsTab({ agency, onUpdated }: { agency: Agency; onUpdated: (a: Agency) => void }) {
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setBusy('connect')
    setError(null)
    try {
      const { stripeConnectStart } = await import('../../lib/api')
      const r = await stripeConnectStart(window.location.origin)
      // Redirect into Stripe's OAuth screen
      window.location.href = r.url
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(null)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Stripe-Verbindung trennen? Du kannst danach keine Kunden mehr direkt abrechnen.')) return
    setBusy('disconnect')
    setError(null)
    try {
      const { stripeConnectDisconnect } = await import('../../lib/api')
      const r = await stripeConnectDisconnect()
      const { data } = await supabase.from('agencies').select('*').eq('id', agency.id).maybeSingle()
      if (data) onUpdated(data as Agency)
      if (r.stripe_revoke_error) {
        setError(`Lokal getrennt, aber Stripe meldete: ${r.stripe_revoke_error}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const isConnected = agency.stripe_connect_status === 'active' && agency.stripe_connect_account_id

  return (
    <div className="glass-card-lg p-7">
      <p className="eyebrow mb-2">Zahlungen</p>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Stripe-Verbindung</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        Verbinde deinen Stripe-Account, damit deine Kunden direkt an dich zahlen.
        OpenPenguin Voice behält keine Gebühren von deinen Einnahmen.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <p className="label-soft mb-1.5">Status</p>
          <div className="flex items-center gap-3">
            {isConnected && <span className="pill-success">✓ Verbunden</span>}
            {agency.stripe_connect_status === 'pending' && <span className="pill-warn">Wird aktiviert…</span>}
            {agency.stripe_connect_status === 'disconnected' && <span className="pill-neutral">Getrennt</span>}
            {agency.stripe_connect_status === 'none' && <span className="pill-neutral">Nicht verbunden</span>}
          </div>
        </div>
        {agency.stripe_connect_account_id && (
          <Field label="Stripe Account ID" value={agency.stripe_connect_account_id} />
        )}
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {!isConnected && (
          <button
            onClick={handleConnect}
            disabled={busy !== null}
            className="btn-primary"
          >
            {busy === 'connect' ? 'Leite weiter…' : 'Mit Stripe verbinden'}
          </button>
        )}
        {isConnected && (
          <button
            onClick={handleDisconnect}
            disabled={busy !== null}
            className="btn-ghost"
          >
            {busy === 'disconnect' ? 'Trenne…' : 'Verbindung trennen'}
          </button>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white/40 p-4 text-xs text-ink-muted leading-relaxed">
        <p className="font-semibold text-ink-soft mb-1">Wie funktioniert das?</p>
        <p>
          Klick auf "Mit Stripe verbinden" → du wirst zu Stripe weitergeleitet → du
          autorisierst OpenPenguin Voice → wir kriegen deine Stripe-Account-ID
          (kein Zugriff auf deine Daten, nur Charge-Authority für deine Kunden).
          Pro Charge zahlst du Stripe-Standard-Gebühren (≈1,4% + 0,25€ EU);
          OpenPenguin Voice behält 0%.
        </p>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-soft mb-1.5">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  )
}

function ColorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-soft mb-1.5">{label}</p>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg border border-white/60 shadow-inner" style={{ background: value }} />
        <code className="rounded bg-white/60 px-2 py-1 text-xs">{value}</code>
      </div>
    </div>
  )
}
