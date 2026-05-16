// /platform-admin/agencies/:id — single agency detail + admin actions.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { supabase } from '../lib/supabase'
import type { Agency, Customer } from '../types/db'

export function PlatformAdminAgencyDetail() {
  const { id } = useParams<{ id: string }>()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const { data: a, error: agErr } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (agErr || !a) {
      setError(agErr?.message ?? 'not_found')
      setLoading(false)
      return
    }
    setAgency(a as Agency)

    const [{ data: c }, { data: u }] = await Promise.all([
      supabase.from('customers').select('*').eq('agency_id', id).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id').eq('id', a.owner_user_id).maybeSingle(),
    ])
    setCustomers((c ?? []) as Customer[])
    // We can't easily read auth.users from client; the owner_user_id is enough — leave email as null for now.
    setOwnerEmail(u ? `(uid: ${u.id})` : null)
    setLoading(false)
  }

  useEffect(() => { void load() }, [id])

  const doAction = async (label: string, patch: Partial<Agency>) => {
    if (!agency) return
    setActionBusy(label)
    setActionMsg(null)
    try {
      const { error } = await supabase.from('agencies').update(patch).eq('id', agency.id)
      if (error) throw new Error(error.message)
      setActionMsg(`✓ ${label} ausgeführt`)
      await load()
    } catch (e) {
      setActionMsg(`✗ ${label} fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setActionBusy(null)
    }
  }

  if (loading) {
    return (
      <AppShell pageEyebrow="Agency" pageTitle="Lade…" backTo="/platform-admin/agencies" backLabel="Zur Übersicht">
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      </AppShell>
    )
  }
  if (error || !agency) {
    return (
      <AppShell pageEyebrow="Agency" pageTitle="Nicht gefunden" backTo="/platform-admin/agencies" backLabel="Zur Übersicht">
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
          {error ?? 'Agency nicht gefunden'}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      pageEyebrow="Agency"
      pageTitle={<>{agency.display_name}</>}
      backTo="/platform-admin/agencies"
      backLabel="Zur Übersicht"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <section className="glass-card-lg p-7">
            <p className="eyebrow mb-2">Brand</p>
            <div className="space-y-4">
              <Row label="Anzeigename" value={agency.display_name} />
              <Row label="Slug (Standard-Subdomain)" value={`${agency.slug}.openpenguin.de`} />
              <Row label="Custom Domain" value={agency.custom_domain ?? '—'} />
              <Row label="Custom Domain Status" value={agency.custom_domain_status} />
              <Row label="Brand-Farbe" value={agency.brand_color}>
                <div className="h-5 w-5 rounded-md border border-white/60" style={{ background: agency.brand_color }} />
              </Row>
              <Row label="Logo URL" value={agency.logo_url ?? '—'} />
            </div>
          </section>

          <section className="glass-card-lg p-7">
            <p className="eyebrow mb-2">Stripe Connect</p>
            <div className="space-y-3">
              <Row label="Status" value={agency.stripe_connect_status} />
              <Row label="Connected Account ID" value={agency.stripe_connect_account_id ?? '—'} />
            </div>
          </section>

          <section className="glass-card-lg p-7">
            <p className="eyebrow mb-2">Kunden ({customers.length})</p>
            {customers.length === 0 ? (
              <p className="text-sm text-ink-muted">Noch keine Kunden angelegt.</p>
            ) : (
              <ul className="divide-y divide-white/60">
                {customers.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted">{c.contact_email}</p>
                    </div>
                    <span className="text-xs text-ink-muted">
                      {new Date(c.created_at).toLocaleDateString('de-DE')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="glass-card p-5">
            <p className="eyebrow mb-2">Owner</p>
            <p className="text-xs text-ink-muted break-all">
              user_id: <code>{agency.owner_user_id}</code>
            </p>
            {ownerEmail && <p className="text-xs text-ink-muted">{ownerEmail}</p>}
          </section>

          <section className="glass-card p-5">
            <p className="eyebrow mb-2">Limits + Meta</p>
            <Row label="Status" value={agency.status} />
            <Row label="Max Kunden" value={String(agency.max_customers)} />
            <Row label="Erstellt" value={new Date(agency.created_at).toLocaleDateString('de-DE')} />
            <Row label="Geupdated" value={new Date(agency.updated_at).toLocaleDateString('de-DE')} />
          </section>

          <section className="glass-card p-5">
            <p className="eyebrow mb-3">Aktionen</p>
            {actionMsg && (
              <div className={`mb-3 rounded-lg p-2 text-xs ${actionMsg.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {actionMsg}
              </div>
            )}
            <div className="space-y-2">
              {agency.status === 'active' && (
                <button
                  onClick={() => doAction('Suspendieren', { status: 'suspended' })}
                  disabled={actionBusy !== null}
                  className="btn-ghost w-full text-sm"
                >
                  {actionBusy === 'Suspendieren' ? '…' : 'Suspendieren'}
                </button>
              )}
              {agency.status === 'suspended' && (
                <button
                  onClick={() => doAction('Reaktivieren', { status: 'active' })}
                  disabled={actionBusy !== null}
                  className="btn-ghost w-full text-sm"
                >
                  {actionBusy === 'Reaktivieren' ? '…' : 'Reaktivieren'}
                </button>
              )}
              {agency.stripe_connect_status === 'active' && (
                <button
                  onClick={() => doAction('Stripe trennen', { stripe_connect_status: 'disconnected', stripe_connect_account_id: null })}
                  disabled={actionBusy !== null}
                  className="btn-ghost w-full text-sm"
                >
                  {actionBusy === 'Stripe trennen' ? '…' : 'Stripe-Verbindung trennen'}
                </button>
              )}
              {agency.custom_domain && agency.custom_domain_status !== 'verified' && (
                <button
                  onClick={() => doAction('Manuelle Verifizierung', { custom_domain_status: 'verified', custom_domain_verified_at: new Date().toISOString() })}
                  disabled={actionBusy !== null}
                  className="btn-ghost w-full text-sm"
                >
                  {actionBusy === 'Manuelle Verifizierung' ? '…' : 'Custom-Domain manuell verifizieren'}
                </button>
              )}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-ink-dim">
              Suspendieren blockiert nur das Tenant-Lookup (`get_agency_branding` filtert nach status='active') — die DB-Daten bleiben unangetastet.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}

function Row({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="label-soft mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        {children}
        <p className="text-sm text-ink break-all">{value}</p>
      </div>
    </div>
  )
}
