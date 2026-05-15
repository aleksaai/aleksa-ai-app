// Admin call detail page — wraps CallDetailContent in AppShell.
// Customer-side call detail now lives inside CustomerAgentDetail (so the
// agent sidebar stays visible while viewing a call).

import { useNavigate, useParams } from 'react-router-dom'
import { CallDetailContent } from '../components/CallDetailContent'
import { AppShell } from '../components/AppShell'

export function CallDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return (
      <AppShell>
        <div className="glass-card p-10 text-center text-sm text-ink-muted">
          Keine Anruf-ID übergeben.
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell backTo="/admin" backLabel="Zurück zur Übersicht">
      <CallDetailContent
        callId={id}
        onBack={() => navigate(-1)}
        backLabel="Zurück"
      />
    </AppShell>
  )
}
