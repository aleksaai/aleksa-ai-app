// /agency — Partner dashboard overview.
// Shows top-level stats for the agency's portfolio of customers + voice agents.
// Stats are loaded directly from the DB via the RLS-scoped supabase client
// (agency_owner sees only their own agency's rows).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AgencyShell } from '../../components/AgencyShell'
import { useAuth } from '../../lib/auth'
import { useTenant } from '../../lib/tenant'
import { supabase } from '../../lib/supabase'

type Stats = {
  customers: number
  voice_agents: number
  calls_30d: number
  call_minutes_30d: number
}

export function AgencyHome() {
  const { profile } = useAuth()
  const { agency } = useTenant()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.agency_id) return
    const load = async () => {
      setLoading(true)
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [customers, voiceAgents, calls] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('voice_agents').select('id', { count: 'exact', head: true }),
        supabase
          .from('calls')
          .select('duration_secs')
          .gte('started_at', cutoff),
      ])

      const callRows = (calls.data ?? []) as { duration_secs: number }[]
      const totalSecs = callRows.reduce((acc, c) => acc + (c.duration_secs ?? 0), 0)

      setStats({
        customers: customers.count ?? 0,
        voice_agents: voiceAgents.count ?? 0,
        calls_30d: callRows.length,
        call_minutes_30d: Math.round(totalSecs / 60),
      })
      setLoading(false)
    }
    void load()
  }, [profile?.agency_id])

  return (
    <AgencyShell pageEyebrow="Übersicht" pageTitle={<>Willkommen <span className="heading-accent">zurück</span></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kunden" value={loading ? '–' : String(stats?.customers ?? 0)} cta={{ to: '/agency/customers', label: 'verwalten →' }} />
        <StatCard label="Voice-Agents" value={loading ? '–' : String(stats?.voice_agents ?? 0)} cta={{ to: '/agency/agents', label: 'verwalten →' }} />
        <StatCard label="Anrufe (30 Tage)" value={loading ? '–' : String(stats?.calls_30d ?? 0)} />
        <StatCard label="Minuten (30 Tage)" value={loading ? '–' : String(stats?.call_minutes_30d ?? 0)} />
      </div>

      {agency && (
        <div className="mt-8 glass-card p-6">
          <p className="eyebrow mb-2">Dein Whitelabel</p>
          <p className="text-sm text-ink-soft">
            Deine Plattform läuft unter{' '}
            <code className="rounded bg-white/60 px-2 py-0.5 text-xs">https://{agency.slug}.openpenguin.de</code>
            {' '}— teile diesen Link mit deinen Kunden.
          </p>
          <div className="mt-3 flex gap-2 text-xs">
            <Link to="/agency/settings" className="btn-subtle">Whitelabel anpassen</Link>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionCard
          title="Neuen Kunden anlegen"
          description="Onboarde einen Endkunden mit eigenem Account."
          to="/agency/customers"
        />
        <ActionCard
          title="Stripe verbinden"
          description="Verknüpfe deinen Stripe-Account um Kunden direkt abzurechnen."
          to="/agency/settings"
        />
      </div>
    </AgencyShell>
  )
}

function StatCard({ label, value, cta }: { label: string; value: string; cta?: { to: string; label: string } }) {
  return (
    <div className="glass-card p-5">
      <p className="label-soft mb-2">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {cta && (
        <Link to={cta.to} className="mt-3 inline-block text-xs font-medium" style={{ color: 'var(--accent-700)' }}>
          {cta.label}
        </Link>
      )}
    </div>
  )
}

function ActionCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Link to={to} className="glass-card group block p-5 transition-shadow hover:shadow-lg">
      <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-700)' }}>
        Weiter →
      </span>
    </Link>
  )
}
