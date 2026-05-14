// admin-get-call-detail Edge Function
// Returns the full call detail (metadata, transcript, has_audio) by fetching
// from ElevenLabs Conversational AI API.
//
// Permissions:
//   - admin: always full access
//   - customer_owner of the call's customer:
//       - metadata: needs can_view_calls
//       - transcript: needs can_view_transcripts
//       - audio_available flag: needs can_view_audio

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

function elevenlabsBase(_region: string | null): string {
  return 'https://api.elevenlabs.io'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'missing_auth' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role, customer_id').eq('id', user.id).maybeSingle()
    if (!profile) return json({ error: 'no_profile' }, 403)

    const body = await req.json().catch(() => ({}))
    const call_id = (body.call_id ?? '').toString().trim()
    if (!call_id) return json({ error: 'call_id_required' }, 400)

    // Load call + agent + integration
    const { data: call } = await supabaseAdmin
      .from('calls')
      .select(`
        id, elevenlabs_conversation_id, started_at, duration_secs,
        elevenlabs_cost_credits, termination_reason,
        voice_agent_id, customer_id,
        voice_agents(display_name, platform_agent_id, integrations(api_key, platform, region)),
        customers(name)
      `)
      .eq('id', call_id)
      .maybeSingle()
    if (!call) return json({ error: 'call_not_found' }, 404)

    // Determine permissions
    let canViewCalls = false
    let canViewTranscripts = false
    let canViewAudio = false

    if (profile.role === 'admin') {
      canViewCalls = canViewTranscripts = canViewAudio = true
    } else if (profile.role === 'customer_owner' && call.customer_id === profile.customer_id) {
      const { data: perms } = await supabaseAdmin
        .from('customer_permissions')
        .select('can_view_calls, can_view_transcripts, can_view_audio')
        .eq('customer_id', profile.customer_id).maybeSingle()
      canViewCalls = perms?.can_view_calls ?? false
      canViewTranscripts = perms?.can_view_transcripts ?? false
      canViewAudio = perms?.can_view_audio ?? false
    }

    if (!canViewCalls) return json({ error: 'forbidden' }, 403)

    const va = (call as any).voice_agents
    const integration = va?.integrations
    if (!integration) return json({ error: 'no_integration' }, 400)
    if (integration.platform !== 'elevenlabs') {
      return json({ error: 'platform_not_yet_supported' }, 501)
    }

    // Fetch live conversation detail from ElevenLabs
    const base = elevenlabsBase(integration.region)
    const conv_id = call.elevenlabs_conversation_id
    const detailRes = await fetch(`${base}/v1/convai/conversations/${conv_id}`, {
      headers: { 'xi-api-key': integration.api_key },
    })

    let liveTranscript: any[] | null = null
    let hasAudio = false
    let analysisSummary: string | null = null
    if (detailRes.ok) {
      const det = await detailRes.json()
      liveTranscript = det.transcript ?? null
      hasAudio = det.has_audio ?? false
      analysisSummary = det.analysis?.transcript_summary ?? null
    } else {
      // ElevenLabs may have deleted the conversation (deletion_settings) — non-fatal
      console.warn(`ElevenLabs conv fetch failed for ${conv_id}: ${detailRes.status}`)
    }

    return json({
      ok: true,
      id: call.id,
      conversation_id: conv_id,
      started_at: call.started_at,
      duration_secs: call.duration_secs,
      cost_credits: call.elevenlabs_cost_credits,
      termination_reason: call.termination_reason,
      agent_name: va?.display_name ?? va?.platform_agent_id ?? null,
      customer_name: (call as any).customers?.name ?? null,
      transcript: canViewTranscripts ? liveTranscript : null,
      transcript_summary: canViewTranscripts ? analysisSummary : null,
      audio_available: canViewAudio && hasAudio,
      permissions: { canViewCalls, canViewTranscripts, canViewAudio },
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: e instanceof Error ? e.message : String(e) }, 500)
  }
})
