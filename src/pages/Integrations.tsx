import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import type { Integration } from '../types/db'
import { NewIntegrationDialog } from '../components/NewIntegrationDialog'
import { AppShell } from '../components/AppShell'

const PLATFORM_LABEL: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  retellai: 'Retell AI',
  vapi: 'Vapi',
  openai: 'OpenAI',
}

export function Integrations() {
  const [list, setList] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('integrations')
      .select('id, name, platform, region, active, created_at, updated_at')
      .is('agency_id', null)
      .order('created_at', { ascending: false })
    setList((data ?? []) as Integration[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <AppShell
      pageEyebrow="Integrationen"
      pageTitle={
        <>
          Verbundene <span className="heading-accent">Plattformen</span>
        </>
      }
      pageAction={
        <button onClick={() => setDialogOpen(true)} className="btn-primary">
          <PlusIcon /> Neue Integration
        </button>
      }
    >
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade…</div>
      ) : list.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-lg p-12 text-center"
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background:
                'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.2) 0%, rgba(var(--accent-400-rgb), 0.4) 100%)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-700)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 7V2m6 5V2M5 13a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold tracking-tight">
            Noch <span className="heading-accent">keine Integrationen</span>
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
            Verbinde ElevenLabs, RetellAI, Vapi oder OpenAI, um Voice-Agenten anzulegen.
          </p>
          <button onClick={() => setDialogOpen(true)} className="btn-primary mt-6">
            <PlusIcon /> Erste Integration verbinden
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((i, idx) => (
            <motion.div
              key={i.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              className="group rounded-2xl glass p-5"
            >
              <div className="flex items-start gap-3">
                <PlatformLogo platform={i.platform} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold tracking-tight text-ink">{i.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {PLATFORM_LABEL[i.platform] ?? i.platform}
                  </p>
                </div>
                {i.active ? (
                  <span className="pill-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Aktiv
                  </span>
                ) : (
                  <span className="pill-neutral">Inaktiv</span>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/40 pt-3 text-xs text-ink-muted">
                <span>
                  Seit{' '}
                  {new Date(i.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                {i.platform === 'elevenlabs' && i.region && (
                  <span className="pill-brand">{i.region.toUpperCase()}</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <NewIntegrationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </AppShell>
  )
}

function PlatformLogo({ platform }: { platform: string }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      style={{
        background:
          'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.18) 0%, rgba(var(--accent-400-rgb), 0.08) 100%)',
        border: '1px solid rgba(var(--accent-400-rgb), 0.25)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {platform === 'elevenlabs' && (
          <>
            <path d="M9 5v14M15 5v14" />
            <path d="M5 9v6M19 9v6" />
          </>
        )}
        {platform === 'retellai' && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </>
        )}
        {platform === 'vapi' && <path d="M3 12h4l3-8 4 16 3-8h4" />}
        {platform === 'openai' && (
          <>
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="9" />
          </>
        )}
        {!['elevenlabs', 'retellai', 'vapi', 'openai'].includes(platform) && (
          <path d="M9 7V2m6 5V2M5 13a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-3z" />
        )}
      </svg>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
