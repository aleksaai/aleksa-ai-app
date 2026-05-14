// link-invitation Edge Function
// Called AFTER the customer-owner has signed in via Magic Link.
// Validates that user's email matches invitation, sets profile.customer_id,
// and marks the invitation as used.

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'missing_auth' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const body = await req.json().catch(() => ({}))
    const token = (body.token ?? '').toString().trim()
    if (!token) return json({ error: 'token_required' }, 400)

    // Verify caller (must be authenticated)
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized' }, 401)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Lookup invitation
    const { data: invitation } = await supabaseAdmin
      .from('customer_invitations')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (!invitation) return json({ error: 'invitation_not_found' }, 404)
    if (invitation.used_at) return json({ error: 'invitation_already_used' }, 410)
    if (new Date(invitation.expires_at) < new Date()) return json({ error: 'invitation_expired' }, 410)
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      return json({ error: 'email_mismatch', detail: 'invitation was issued for a different email' }, 403)
    }

    // Link profile to customer + mark invitation used (atomic-ish — two separate updates)
    const { error: profErr } = await supabaseAdmin
      .from('profiles')
      .update({ customer_id: invitation.customer_id })
      .eq('id', user.id)
    if (profErr) return json({ error: 'profile_update_failed', detail: profErr.message }, 500)

    const { error: invMarkErr } = await supabaseAdmin
      .from('customer_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('id', invitation.id)
    if (invMarkErr) return json({ error: 'invitation_mark_failed', detail: invMarkErr.message }, 500)

    return json({ ok: true, customer_id: invitation.customer_id })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
