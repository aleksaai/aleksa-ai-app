// /agency/settings — agency settings hub with sub-tabs.
// Tabs: Whitelabel (brand/logo), Domain (subdomain + custom), Payments (Stripe Connect).
// Phase C: tab structure + read-only displays. Phase F wires whitelabel editor,
// Phase G wires Stripe Connect button, Phase H wires custom-domain verification.

import { useEffect, useState } from 'react'
import { AgencyShell } from '../../components/AgencyShell'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import type { Agency } from '../../types/db'

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

// ─── Whitelabel tab — Phase F wires the inputs ──────────────────────────
function WhitelabelTab({ agency, onUpdated: _onUpdated }: { agency: Agency; onUpdated: (a: Agency) => void }) {
  return (
    <div className="glass-card-lg p-7">
      <p className="eyebrow mb-2">Branding</p>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Whitelabel-Einstellungen</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        So sieht deine Plattform aus für deine Kunden.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Anzeigename" value={agency.display_name} />
        <Field label="Slug (Subdomain)" value={`${agency.slug}.openpenguin.de`} />
        <ColorField label="Brand-Farbe" value={agency.brand_color} />
        <Field label="Logo URL" value={agency.logo_url ?? '— noch nicht gesetzt'} />
        <Field label="Favicon URL" value={agency.favicon_url ?? '— noch nicht gesetzt'} />
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
        <strong>Phase F:</strong> Editor für Anzeigename + Brand-Farbe + Logo-Upload wird in Kürze hinzugefügt.
      </div>
    </div>
  )
}

// ─── Domain tab — Phase H wires custom domain verification ─────────────
function DomainTab({ agency }: { agency: Agency; onUpdated: (a: Agency) => void }) {
  return (
    <div className="glass-card-lg p-7">
      <p className="eyebrow mb-2">Domain</p>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Eigene Domain</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        Deine Plattform läuft automatisch unter <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">{agency.slug}.openpenguin.de</code>.
        Optional kannst du eine eigene Domain hinzufügen (z.B. <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">app.deine-firma.de</code>).
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Standard-Subdomain" value={`${agency.slug}.openpenguin.de`} />
        <Field label="Eigene Domain" value={agency.custom_domain ?? '— nicht gesetzt'} />
        <Field label="Status" value={agency.custom_domain_status === 'none' ? 'nicht konfiguriert' : agency.custom_domain_status} />
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
        <strong>Phase H:</strong> CNAME-Konfiguration + DNS-Verifizierung + Netlify-Domain-Alias-Setup folgt in Kürze.
      </div>
    </div>
  )
}

// ─── Payments tab — Phase G wires Stripe Connect ───────────────────────
function PaymentsTab({ agency }: { agency: Agency; onUpdated: (a: Agency) => void }) {
  return (
    <div className="glass-card-lg p-7">
      <p className="eyebrow mb-2">Zahlungen</p>
      <h2 className="text-xl font-semibold tracking-tight text-ink">Stripe-Verbindung</h2>
      <p className="mt-1.5 text-sm text-ink-muted">
        Verbinde deinen Stripe-Account, damit deine Kunden direkt an dich zahlen.
        OpenPenguin Voice behält keine Gebühren von deinen Einnahmen.
      </p>

      <div className="mt-6 space-y-5">
        <Field label="Status" value={
          agency.stripe_connect_status === 'active' ? '✓ Aktiv' :
          agency.stripe_connect_status === 'pending' ? 'Wird aktiviert…' :
          agency.stripe_connect_status === 'disconnected' ? 'Getrennt' :
          '— nicht verbunden'
        } />
        {agency.stripe_connect_account_id && (
          <Field label="Stripe Account ID" value={agency.stripe_connect_account_id} />
        )}
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
        <strong>Phase G:</strong> Stripe-Connect-OAuth-Flow folgt in Kürze. Solange behandelt Aleksa Kunden-Billing manuell für dich.
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
