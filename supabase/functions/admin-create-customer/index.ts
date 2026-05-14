// admin-create-customer Edge Function
// Called by /admin UI to onboard a new customer.
// Flow: verify admin → create Stripe Customer → insert DB row → generate invitation token → send email.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'
import { Resend } from 'https://esm.sh/resend@4.0.1'

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
    // ── 1. Auth ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'missing_auth' }, 401)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await supabaseAuth.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized', detail: authErr?.message }, 401)

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.role !== 'admin') return json({ error: 'admin_only' }, 403)

    // ── 2. Input ──
    const body = await req.json().catch(() => ({}))
    const name = (body.name ?? '').toString().trim()
    const contactEmail = (body.contact_email ?? '').toString().trim().toLowerCase()
    if (!name || !contactEmail) {
      return json({ error: 'name_and_contact_email_required' }, 400)
    }

    // ── 3. Stripe Customer (with metadata for Lisa-filter) ──
    const stripeRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name,
        email: contactEmail,
        'metadata[source]': 'aleksa-ai-app',
      }),
    })
    if (!stripeRes.ok) {
      const detail = await stripeRes.text()
      return json({ error: 'stripe_customer_creation_failed', detail }, 500)
    }
    const stripeCustomer = await stripeRes.json()

    // ── 4. Insert Customer row ──
    const { data: customer, error: custErr } = await supabaseAdmin
      .from('customers')
      .insert({
        name,
        contact_email: contactEmail,
        stripe_customer_id: stripeCustomer.id,
      })
      .select()
      .single()
    if (custErr) return json({ error: 'customer_insert_failed', detail: custErr.message }, 500)

    // ── 5. Invitation token ──
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { error: invErr } = await supabaseAdmin.from('customer_invitations').insert({
      customer_id: customer.id,
      email: contactEmail,
      token,
      expires_at: expiresAt,
    })
    if (invErr) return json({ error: 'invitation_insert_failed', detail: invErr.message }, 500)

    // ── 6. Email via Resend (non-fatal if it fails) ──
    let emailSent = false
    try {
      const resend = new Resend(RESEND_API_KEY)
      const inviteLink = `${APP_URL}/invite/${token}`
      const r = await resend.emails.send({
        from: 'AleksaAI App <noreply@projekt.aleksa.ai>',
        to: contactEmail,
        subject: `Einladung zur AleksaAI App — ${name}`,
        html: `
          <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h1 style="font-size: 24px; margin: 0 0 16px;">Hallo,</h1>
            <p style="font-size: 16px; line-height: 1.5; color: #475569;">
              du wurdest zur AleksaAI App eingeladen — der Plattform für deine Voice-Agent-Verwaltung.
            </p>
            <p style="margin: 24px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: #66A4FF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Konto aktivieren
              </a>
            </p>
            <p style="font-size: 14px; color: #64748b;">
              Oder kopier diesen Link in deinen Browser: <br>
              <code style="font-size: 12px;">${inviteLink}</code>
            </p>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
              Der Link läuft in 7 Tagen ab.
            </p>
          </div>
        `,
      })
      emailSent = !r.error
    } catch (_e) {
      // Email-Failure ist non-fatal — Admin sieht den Invite-Link in der Response und kann manuell teilen
      emailSent = false
    }

    return json({
      ok: true,
      customer_id: customer.id,
      stripe_customer_id: stripeCustomer.id,
      invitation_token: token,
      invite_link: `${APP_URL}/invite/${token}`,
      email_sent: emailSent,
    })
  } catch (e) {
    return json({ error: 'unexpected', detail: String(e) }, 500)
  }
})
