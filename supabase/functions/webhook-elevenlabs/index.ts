// webhook-elevenlabs Edge Function
// Receives post_call_transcription events from ElevenLabs Conversational AI.
// Verifies HMAC signature with ELEVENLABS_WEBHOOK_HMAC_SECRET,
// then inserts a row into `calls` (idempotent via UNIQUE elevenlabs_conversation_id).
//
// Payload shape (relevant fields):
// {
//   type: "post_call_transcription",
//   event_timestamp: <unix-secs>,
//   data: {
//     agent_id: "agent_xxx",
//     conversation_id: "conv_xxx",
//     status: "done",
//     metadata: {
//       start_time_unix_secs: <unix-secs>,
//       call_duration_secs: <int>,
//       cost: <float in USD>,
//       termination_reason: "...",
//       ...
//     },
//     transcript: [...],
//     analysis: {...},
//   }
// }
//
// HMAC header: `elevenlabs-signature` — format `t=<timestamp>,v0=<hex>`
//   signed_payload = `${timestamp}.${rawBody}` → HMAC-SHA256 → hex

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function verifyHmac(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  // ElevenLabs signature format: `t=<unix>,v0=<hex>`
  const parts = signatureHeader.split(',')
  let timestamp = ''
  let signature = ''
  for (const p of parts) {
    const [k, v] = p.split('=', 2)
    if (k === 't') timestamp = v
    if (k === 'v0') signature = v
  }
  if (!timestamp || !signature) return false

  // Reject signatures older than 30 minutes (replay-protection)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 30 * 60) return false

  const payload = `${timestamp}.${rawBody}`

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload))
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time compare
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const signature = req.headers.get('elevenlabs-signature')
  if (!signature) return json({ error: 'missing_signature' }, 400)

  const rawBody = await req.text()
  const secret = Deno.env.get('ELEVENLABS_WEBHOOK_HMAC_SECRET')
  if (!secret) {
    console.error('ELEVENLABS_WEBHOOK_HMAC_SECRET not configured')
    return json({ error: 'server_misconfigured' }, 500)
  }

  const valid = await verifyHmac(rawBody, signature, secret)
  if (!valid) return json({ error: 'invalid_signature' }, 400)

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  // Only handle post_call_transcription for now
  if (event.type !== 'post_call_transcription') {
    return json({ received: true, ignored: event.type })
  }

  const data = event.data ?? {}
  const agent_id = data.agent_id as string | undefined
  const conversation_id = data.conversation_id as string | undefined
  const metadata = data.metadata ?? {}
  const start_time_unix_secs = metadata.start_time_unix_secs as number | undefined
  const call_duration_secs = metadata.call_duration_secs as number | undefined
  const cost = metadata.cost as number | undefined // USD float (not cents)
  const termination_reason = metadata.termination_reason as string | undefined

  if (!agent_id || !conversation_id || call_duration_secs == null || start_time_unix_secs == null) {
    return json({ error: 'incomplete_payload', detail: 'missing agent_id / conversation_id / metadata fields' }, 400)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find the voice_agent (only ElevenLabs integrations match)
  const { data: agentRow } = await supabaseAdmin
    .from('voice_agents')
    .select('id, customer_id, integrations!inner(platform)')
    .eq('platform_agent_id', agent_id)
    .eq('integrations.platform', 'elevenlabs')
    .maybeSingle()

  if (!agentRow) {
    // Agent is in ElevenLabs but not registered in our platform — log + 200 so ElevenLabs doesn't retry
    console.warn(`Webhook for unregistered agent ${agent_id} (conv ${conversation_id})`)
    return json({ received: true, ignored: 'unregistered_agent' })
  }

  // Cost arrives in USD as a float (e.g. 0.087 = 8.7 cents).
  // Round to whole cents for our integer column.
  const cost_cents = cost != null ? Math.round(cost * 100) : null

  // Insert (idempotent via UNIQUE elevenlabs_conversation_id)
  const { error: insErr } = await supabaseAdmin
    .from('calls')
    .insert({
      voice_agent_id: agentRow.id,
      customer_id: agentRow.customer_id,
      elevenlabs_conversation_id: conversation_id,
      started_at: new Date(start_time_unix_secs * 1000).toISOString(),
      duration_secs: Math.max(0, Math.floor(call_duration_secs)),
      elevenlabs_cost_cents: cost_cents,
      termination_reason: termination_reason ?? null,
      raw_payload: data,
    })

  if (insErr) {
    // 23505 = unique violation = duplicate webhook (retry) — that's OK
    if (insErr.code === '23505') {
      return json({ received: true, idempotent: true })
    }
    console.error('Call insert failed:', insErr)
    return json({ error: 'insert_failed', detail: insErr.message }, 500)
  }

  return json({ received: true, conversation_id, duration_secs: call_duration_secs })
})
