import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { Customer, VoiceAgent } from '../types/db'
import { CustomerShell } from '../components/CustomerShell'

type Props = {
  customerIdOverride?: string
  isAdminPreview?: boolean
}

export function Dashboard({ customerIdOverride, isAdminPreview }: Props = {}) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [agents, setAgents] = useState<VoiceAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const targetCustomerId = customerIdOverride ?? profile?.customer_id ?? null

  useEffect(() => {
    if (!targetCustomerId) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const { data: c } = await supabase
        .from('customers')
        .select('*')
        .eq('id', targetCustomerId)
        .maybeSingle()
      setCustomer(c as Customer | null)

      const { data: a } = await supabase
        .from('voice_agents')
        .select('*')
        .eq('customer_id', targetCustomerId)
        .eq('active', true)
        .order('updated_at', { ascending: false })
      setAgents((a ?? []) as VoiceAgent[])

      setLoading(false)
    })()
  }, [targetCustomerId])

  const filtered = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase().trim()
    return agents.filter((a) => (a.display_name ?? '').toLowerCase().includes(q))
  }, [agents, search])

  const handleAgentClick = (id: string) => {
    if (isAdminPreview) {
      navigate(`/admin/agents/${id}`)
    } else {
      navigate(`/dashboard/agents/${id}`)
    }
  }

  if (loading) {
    return (
      <CustomerShell customerName={customer?.name}>
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      </CustomerShell>
    )
  }

  if (!customer) {
    return (
      <CustomerShell>
        <div className="glass-card-lg mx-auto max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold tracking-tight">Kein Konto verknüpft</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Dein Profil hat keine Kunden-Zuordnung. Bitte kontaktiere den Admin.
          </p>
        </div>
      </CustomerShell>
    )
  }

  return (
    <CustomerShell
      customerName={customer.name}
      adminPreview={isAdminPreview}
      onExitPreview={() => (window.location.href = `/admin/customers/${customer.id}`)}
      pageTitle={
        <>
          Deine <span className="heading-accent">Agenten</span>
        </>
      }
    >
      {agents.length === 0 ? (
        <div className="glass-card-lg p-12 text-center">
          <h2 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Agenten</span>
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Sobald dir ein Voice-Agent zugewiesen ist, erscheint er hier.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <SearchBar
              value={search}
              onChange={setSearch}
              count={filtered.length}
              total={agents.length}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card p-10 text-center text-sm text-ink-muted">
              Keine Agenten gefunden für "<strong className="text-ink">{search}</strong>".
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((agent, i) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  index={i}
                  onClick={() => handleAgentClick(agent.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </CustomerShell>
  )
}

function AgentCard({
  agent,
  index,
  onClick,
}: {
  agent: VoiceAgent
  index: number
  onClick: () => void
}) {
  const lastEdited = new Date(agent.updated_at ?? agent.created_at)
  const dateLabel = lastEdited.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl glass p-6 text-left transition-shadow hover:shadow-glass-lg"
    >
      {/* Avatar block */}
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-white/40 transition-all group-hover:blur-[3px]">
        <AgentAvatar />
      </div>

      {/* Hover overlay with "Dashboard anzeigen" button */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div
          className="pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-glass-lg"
          style={{
            background:
              'linear-gradient(135deg, var(--accent-500) 0%, var(--accent-600) 100%)',
            boxShadow:
              '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 10px 30px -8px rgba(var(--accent-shadow-rgb),0.7)',
          }}
        >
          Dashboard anzeigen →
        </div>
      </div>

      {/* Text */}
      <div className="mt-5">
        <p className="font-semibold tracking-tight text-ink">
          {agent.display_name ?? 'Unbenannter Agent'}
        </p>
        <p className="mt-1 text-xs text-ink-muted">Zuletzt bearbeitet {dateLabel}</p>
      </div>
    </motion.button>
  )
}

function AgentAvatar() {
  return (
    <div
      className="flex h-20 w-20 items-center justify-center rounded-2xl text-white"
      style={{
        background:
          'linear-gradient(135deg, var(--accent-400) 0%, var(--accent-500) 50%, var(--accent-600) 100%)',
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.4) inset, 0 8px 28px -8px rgba(var(--accent-shadow-rgb),0.55)',
      }}
    >
      <svg
        width="38"
        height="38"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  )
}

function SearchBar({
  value,
  onChange,
  count,
  total,
}: {
  value: string
  onChange: (v: string) => void
  count: number
  total: number
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-ink-muted">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Suchen…"
        className="glass-input w-full pl-12 pr-32"
        style={{ paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-ink-muted">
        {value.trim() ? (
          <span>
            {count} von {total}
          </span>
        ) : (
          <span>
            {total} {total === 1 ? 'Agent' : 'Agenten'}
          </span>
        )}
      </div>
    </div>
  )
}
