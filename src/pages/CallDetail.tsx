// CallDetail page — works for both admin (always full access) and customer_owner
// (server enforces permissions). One route for both:
//   - /admin/calls/:id   (Admin context, navigated from CustomerDetail's preview)
//   - /dashboard/calls/:id (Customer context, navigated from Dashboard)

import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../lib/auth'
import { adminGetCallDetail, fetchCallAudioBlobUrl, type CallDetail as CallDetailType } from '../lib/api'
import { formatDuration } from '../lib/billing'

export function CallDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, profile, signOut } = useAuth()
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

  // Load audio on demand (only if detail.audio_available)
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

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const backLink = isAdminRoute ? '/admin' : '/dashboard'

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">
            {profile?.role === 'admin' ? 'AleksaAI Admin' : 'Mein Dashboard'}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.email}</span>
            <button onClick={signOut} className="btn-ghost text-sm">Abmelden</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4">
          <Link to={backLink} className="text-sm text-slate-500 hover:text-slate-900">← Zurück</Link>
        </div>

        {loading ? (
          <div className="card text-center text-sm text-slate-500">Lade Call-Detail…</div>
        ) : error ? (
          <div className="card">
            <h2 className="text-lg font-semibold text-red-700">Kein Zugriff</h2>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </div>
        ) : detail ? (
          <>
            {/* Metadata Card */}
            <section className="card mb-6">
              <h2 className="text-xl font-semibold">Call</h2>
              <p className="mt-1 font-mono text-xs text-slate-500">{detail.conversation_id}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Datum" value={new Date(detail.started_at).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })} />
                <Stat label="Dauer" value={formatDuration(detail.duration_secs)} />
                <Stat label="Agent" value={detail.agent_name ?? '—'} />
                <Stat label="Beendet weil" value={detail.termination_reason ?? '—'} small />
              </div>
              {detail.cost_credits != null && profile?.role === 'admin' && (
                <p className="mt-3 text-xs text-slate-500">
                  ElevenLabs-Kosten (Credits): <strong>{detail.cost_credits}</strong>
                </p>
              )}
            </section>

            {/* Summary (if transcript permission) */}
            {detail.transcript_summary && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mb-6">
                <h3 className="mb-2 text-base font-semibold">Zusammenfassung</h3>
                <p className="text-sm text-slate-700">{detail.transcript_summary}</p>
              </motion.section>
            )}

            {/* Audio (if permission) */}
            {detail.audio_available && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mb-6">
                <h3 className="mb-3 text-base font-semibold">Audio-Aufnahme</h3>
                {!audioUrl ? (
                  <button
                    onClick={handleLoadAudio}
                    disabled={audioLoading}
                    className="btn-primary text-sm"
                  >
                    {audioLoading ? 'Lade Audio…' : '▶ Audio laden'}
                  </button>
                ) : (
                  <audio src={audioUrl} controls className="w-full" />
                )}
                {audioError && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {audioError}
                  </div>
                )}
              </motion.section>
            )}

            {/* Transcript (if permission) */}
            {detail.transcript ? (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card">
                <h3 className="mb-3 text-base font-semibold">Transkript</h3>
                {detail.transcript.length === 0 ? (
                  <p className="text-sm text-slate-500">Kein Transkript verfügbar.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.transcript.map((turn, i) => {
                      const isAgent = turn.role === 'agent'
                      return (
                        <div key={i} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                              isAgent
                                ? 'bg-brand-50 text-slate-900'
                                : 'bg-slate-100 text-slate-900'
                            }`}
                          >
                            <div className="mb-1 text-xs font-medium uppercase tracking-wide opacity-60">
                              {isAgent ? 'Agent' : 'Anrufer'}
                              {typeof turn.time_in_call_secs === 'number' && (
                                <span className="ml-2 font-normal">
                                  {Math.floor(turn.time_in_call_secs / 60)}:{(Math.floor(turn.time_in_call_secs) % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>
                            <div className="whitespace-pre-wrap">{turn.message ?? <em className="text-slate-400">(leer)</em>}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.section>
            ) : detail.permissions.canViewTranscripts === false && profile?.role !== 'admin' ? (
              <div className="card text-center text-sm text-slate-500">
                Transkript-Einsicht ist für deinen Account nicht freigeschaltet.
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 font-semibold text-slate-900 ${small ? 'text-sm' : 'text-base'}`}>{value}</p>
    </div>
  )
}
