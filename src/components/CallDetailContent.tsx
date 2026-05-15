// Reusable inner content of a call detail view.
// Used by:
//   - /admin/calls/:id  (wrapped in AppShell)
//   - /dashboard/agents/:agentId/calls/:callId  (wrapped in AgentShell)

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import {
  adminGetCallDetail,
  fetchCallAudioBlobUrl,
  type CallDetail as CallDetailType,
} from '../lib/api'
import { formatDuration } from '../lib/billing'

export function CallDetailContent({
  callId,
  onBack,
  backLabel,
}: {
  callId: string
  onBack?: () => void
  backLabel?: string
}) {
  const { profile } = useAuth()
  const [detail, setDetail] = useState<CallDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')

  useEffect(() => {
    if (!callId) return
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const d = await adminGetCallDetail(callId)
        setDetail(d)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [callId])

  // Auto-load audio if available + customer has permission
  useEffect(() => {
    if (!callId || !detail?.audio_available || audioUrl || audioLoading) return
    ;(async () => {
      setAudioLoading(true)
      setAudioError('')
      try {
        const url = await fetchCallAudioBlobUrl(callId)
        setAudioUrl(url)
      } catch (e) {
        setAudioError(e instanceof Error ? e.message : String(e))
      } finally {
        setAudioLoading(false)
      }
    })()
  }, [callId, detail?.audio_available])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const handleDownloadAudio = () => {
    if (!audioUrl || !detail) return
    const datePart = new Date(detail.started_at).toISOString().slice(0, 16).replace(/[T:]/g, '-')
    triggerDownload(audioUrl, `anruf-${datePart}.mp3`)
  }

  const handleDownloadTranscript = () => {
    if (!detail) return
    const md = buildTranscriptMarkdown(detail)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const datePart = new Date(detail.started_at).toISOString().slice(0, 16).replace(/[T:]/g, '-')
    triggerDownload(url, `transkript-${datePart}.md`)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  if (loading) {
    return <div className="glass-card p-10 text-center text-sm text-ink-muted">Lade Anruf-Detail…</div>
  }
  if (error) {
    return (
      <div className="glass-card-lg mx-auto max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold text-red-700">Kein Zugriff</h2>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
        {onBack && (
          <button onClick={onBack} className="btn-ghost mt-5">
            ← {backLabel ?? 'Zurück'}
          </button>
        )}
      </div>
    )
  }
  if (!detail) return null

  const canDownloadTranscript = detail.transcript && detail.transcript.length > 0

  return (
    <>
      {/* Back link */}
      {onBack && (
        <button
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:opacity-100 hover:[color:var(--accent-700)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel ?? 'Zurück'}
        </button>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl glass-card-lg p-7">
        <div
          aria-hidden
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--accent-400) 0%, transparent 70%)' }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-1.5">Anruf-Detail</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {new Date(detail.started_at).toLocaleString('de-DE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {new Date(detail.started_at).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              Uhr · {formatDuration(detail.duration_secs)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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

          {/* Download buttons */}
          <div className="flex flex-wrap gap-2">
            {audioUrl && (
              <button onClick={handleDownloadAudio} className="btn-ghost text-sm">
                <DownloadIcon /> Audio (MP3)
              </button>
            )}
            {canDownloadTranscript && (
              <button onClick={handleDownloadTranscript} className="btn-ghost text-sm">
                <DownloadIcon /> Transkript (MD)
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Summary */}
      {detail.transcript_summary && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 glass-card p-6"
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
          {audioLoading ? (
            <p className="text-sm text-ink-muted">Lade Audio…</p>
          ) : audioUrl ? (
            <audio src={audioUrl} controls className="w-full" />
          ) : audioError ? (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700">
              {audioError}
            </div>
          ) : null}
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
                  <div key={i} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
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
  )
}

// ============================================================
// Helpers
// ============================================================

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function buildTranscriptMarkdown(d: CallDetailType): string {
  const dateStr = new Date(d.started_at).toLocaleString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const lines: string[] = []
  lines.push(`# Anruf-Transkript`)
  lines.push('')
  lines.push(`**Datum:** ${dateStr}`)
  if (d.agent_name) lines.push(`**Agent:** ${d.agent_name}`)
  lines.push(`**Dauer:** ${formatDuration(d.duration_secs)}`)
  if (d.termination_reason) lines.push(`**Beendet:** ${d.termination_reason}`)
  lines.push('')
  if (d.transcript_summary) {
    lines.push(`## Zusammenfassung`)
    lines.push('')
    lines.push(d.transcript_summary)
    lines.push('')
  }
  lines.push(`## Verlauf`)
  lines.push('')
  if (d.transcript && d.transcript.length > 0) {
    for (const t of d.transcript) {
      const speaker = t.role === 'agent' ? 'Agent' : 'Anrufer'
      const time =
        typeof t.time_in_call_secs === 'number'
          ? ` _(${Math.floor(t.time_in_call_secs / 60)}:${(Math.floor(t.time_in_call_secs) % 60)
              .toString()
              .padStart(2, '0')})_`
          : ''
      lines.push(`**${speaker}**${time}:`)
      lines.push('')
      lines.push(t.message ?? '_(leer)_')
      lines.push('')
    }
  } else {
    lines.push('_Kein Transkript verfügbar._')
  }
  return lines.join('\n')
}

// ============================================================
// Icons
// ============================================================

function AgentIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v6a4 4 0 0 1 0 8v2" />
      <path d="M5 22v-2a7 7 0 0 1 14 0v2" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}
