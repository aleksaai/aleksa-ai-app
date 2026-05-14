// accept-invitation Edge Function
// Public (no auth required). Two modes:
//   1. GET / POST with {token, action: "info"} → returns invitation details (no email yet)
//   2. POST with {token, action: "send_magic_link"} → triggers Supabase Magic Link to invitation email
//      with user_metadata.invitation_token so we can link on first sign-in.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const token = (body.token ?? '').toString().trim()
    const action = (body.action ?? 'info').toString()

    if (!token) return json({ error: 'token_required' }, 400)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Lookup invitation + customer
    const { data: invitation, error: invErr } = await supabaseAdmin
      .from('customer_invitations')
      .select('id, customer_id, email, used_at, expires_at, customers(name)')
      .eq('token', token)
      .maybeSingle()

    if (invErr || !invitation) return json({ error: 'invitation_not_found' }, 404)
    if (invitation.used_at) return json({ error: 'invitation_already_used' }, 410)
    if (new Date(invitation.expires_at) < new Date()) return json({ error: 'invitation_expired' }, 410)

    const customer = (invitation as any).customers as { name: string } | null

    if (action === 'info') {
      return json({
        ok: true,
        email: invitation.email,
        customer_name: customer?.name ?? 'Unknown',
      })
    }

    if (action === 'send_magic_link') {
      const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
      // signInWithOtp creates a magic link to the user's email.
      // emailRedirectTo lands them on /onboarding where we'll link them to the customer.
      const { error: otpErr } = await supabaseAdmin.auth.signInWithOtp({
        email: invitation.email,
        options: {
          emailRedirectTo: `${APP_URL}/onboarding?invitation_token=${token}`,
          data: { invitation_token: token },
        },
      })
      if (otpErr) return json({ error: 'magic_link_failed', detail: otpErr.message }, 500)
      return json({ ok: true, sent_to: invitation.email })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
