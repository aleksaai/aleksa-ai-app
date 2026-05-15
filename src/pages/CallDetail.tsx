import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { adminGetCallDetail, fetchCallAudioBlobUrl, type CallDetail as CallDetailType } from '../lib/api'
import { formatDuration } from '../lib/billing'
import { CustomerShell } from '../components/CustomerShell'
import { AppShell } from '../components/AppShell'

export function CallDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  const [detail, setDetail] = useState<CallDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const d = await adminGetCallDetail(id)
        setDetail(d)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const handleLoadAudio = async () => {
    if (!id || audioUrl) return
    setAudioLoading(true)
    setAudioError('')
    try {
      const url = await fetchCallAudioBlobUrl(id)
      setAudioUrl(url)
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : String(e))
    } finally {
      setAudioLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const backLink = isAdminRoute ? '/admin' : '/dashboard'
  const backLabel = isAdminRoute ? 'Zurück zur Übersicht' : 'Zurück zum Dashboard'

  const content = (
    <>
      {loading ? (
        <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade Call-Detail…</div>
      ) : error ? (
        <div className="glass-card-lg mx-auto max-w-md p-8 text-center">
          <h2 className="text-lg font-semibold text-red-700">Kein Zugriff</h2>
          <p className="mt-2 text-sm text-ink-muted">{error}</p>
        </div>
      ) : detail ? (
        <>
          {/* Metadata Hero */}
          <section className="relative overflow-hidden rounded-3xl glass-card-lg p-8">
            <div
              aria-hidden
              className="absolute -right-16 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
            />
            <div className="relative">
              <p className="eyebrow mb-1.5">Anruf-Detail</p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {new Date(detail.started_at).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                um{' '}
                {new Date(detail.started_at).toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                Uhr · {formatDuration(detail.duration_secs)}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {detail.agent_name && (
                  <span className="pill-brand">
                    <AgentIcon /> {detail.agent_name}
                  </span>
                )}
                {detail.termination_reason && (
                  <span className="pill-neutral">Ende: {detail.termination_reason}</span>
                )}
              </div>
            </div>
          </section>

          {/* Summary */}
          {detail.transcript_summary && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 glass-card p-6"
            >
              <p className="label-soft mb-2">Zusammenfassung</p>
              <p className="text-sm leading-relaxed text-ink-soft">{detail.transcript_summary}</p>
            </motion.section>
          )}

          {/* Audio */}
          {detail.audio_available && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 glass-card p-6"
            >
              <p className="label-soft mb-3">Audio-Aufnahme</p>
              {!audioUrl ? (
                <button
                  onClick={handleLoadAudio}
                  disabled={audioLoading}
                  className="btn-primary text-sm"
                >
                  {audioLoading ? 'Lade Audio…' : '▶  Audio laden'}
                </button>
              ) : (
                <audio src={audioUrl} controls className="w-full" />
              )}
              {audioError && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
                  {audioError}
                </div>
              )}
            </motion.section>
          )}

          {/* Transcript */}
          {detail.transcript ? (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 glass-card p-6"
            >
              <p className="label-soft mb-4">Transkript</p>
              {detail.transcript.length === 0 ? (
                <p className="text-sm text-ink-muted">Kein Transkript verfügbar.</p>
              ) : (
                <div className="space-y-3">
                  {detail.transcript.map((turn, i) => {
                    const isAgent = turn.role === 'agent'
                    const mins =
                      typeof turn.time_in_call_secs === 'number'
                        ? `${Math.floor(turn.time_in_call_secs / 60)}:${(
                            Math.floor(turn.time_in_call_secs) % 60
                          )
                            .toString()
                            .padStart(2, '0')}`
                        : null
                    return (
                      <div
                        key={i}
                        className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm`}
                          style={{
                            background: isAgent
                              ? 'linear-gradient(135deg, rgba(var(--accent-400-rgb), 0.18) 0%, rgba(var(--accent-400-rgb), 0.1) 100%)'
                              : 'rgba(255, 255, 255, 0.75)',
                            border: isAgent
                              ? '1px solid rgba(var(--accent-400-rgb), 0.25)'
                              : '1px solid rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider opacity-60">
                            <span>{isAgent ? 'Agent' : 'Anrufer'}</span>
                            {mins && <span className="font-normal">{mins}</span>}
                          </div>
                          <div className="whitespace-pre-wrap text-ink">
                            {turn.message ?? <em className="text-ink-dim">(leer)</em>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.section>
          ) : detail.permissions.canViewTranscripts === false && profile?.role !== 'admin' ? (
            <div className="mt-4 glass-card p-6 text-center text-sm text-ink-muted">
              Die Einsicht in Transkripte ist für dein Konto nicht freigeschaltet.
            </div>
          ) : null}
        </>
      ) : null}
    </>
  )

  if (isAdminRoute) {
    return (
      <AppShell backTo={backLink} backLabel={backLabel}>
        {content}
      </AppShell>
    )
  }
  return (
    <CustomerShell backTo={backLink} backLabel={backLabel}>
      {content}
    </CustomerShell>
  )
}

function AgentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v6a4 4 0 0 1 0 8v2" />
      <path d="M5 22v-2a7 7 0 0 1 14 0v2" />
    </svg>
  )
}
