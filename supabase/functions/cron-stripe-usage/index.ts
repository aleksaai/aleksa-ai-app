// cron-stripe-usage Edge Function
// Daily aggregation: sums unreported call minutes per active customer_subscription,
// pushes them as Stripe usage_records on the metered subscription_item, marks
// the calls as reported.
//
// Auth: requires X-Cron-Secret header matching CRON_SECRET env var. pg_cron
// triggers this with the secret hardcoded into the cron job SQL. Aleksa can
// also invoke it manually via curl with the secret for ad-hoc runs.
//
// Pins Stripe-Version 2024-12-18.acacia to keep the legacy
// subscription_items/{id}/usage_records flow working until we migrate to Meters API.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

const STRIPE_API_VERSION = '2024-12-18.acacia'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function postUsageRecord(itemId: string, quantity: number, key: string, idempotencyKey: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscription_items/${itemId}/usage_records`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_API_VERSION,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body: new URLSearchParams({
      quantity: String(quantity),
      timestamp: String(Math.floor(Date.now() / 1000)),
      action: 'increment',
    }),
  })
  if (!res.ok) {
    throw new Error(`Stripe usage_records ${itemId}: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)

  // Auth: shared-secret header (NOT Supabase JWT — pg_cron can't easily get one)
  const provided = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret')
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected) {
    return json({ error: 'server_misconfigured', detail: 'CRON_SECRET not set' }, 500)
  }
  if (!provided || provided !== expected) {
    return json({ error: 'unauthorized' }, 401)
  }

  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch all active recurring subscriptions that have a metered item
  const { data: subs, error: subsErr } = await supabaseAdmin
    .from('customer_subscriptions')
    .select('id, voice_agent_id, customer_id, stripe_subscription_id, stripe_subscription_item_id, status')
    .eq('status', 'active')
    .not('stripe_subscription_item_id', 'is', null)

  if (subsErr) return json({ error: 'subs_query_failed', detail: subsErr.message }, 500)

  const runId = crypto.randomUUID()
  const results: any[] = []
  let totalMinutesPushed = 0
  let subsWithUsage = 0

  for (const sub of subs ?? []) {
    // Sum unreported calls for this voice_agent
    const { data: calls, error: callsErr } = await supabaseAdmin
      .from('calls')
      .select('id, duration_secs')
      .eq('voice_agent_id', sub.voice_agent_id)
      .is('reported_to_stripe_at', null)

    if (callsErr) {
      results.push({ subscription_id: sub.id, error: 'calls_query_failed', detail: callsErr.message })
      continue
    }

    const callList = calls ?? []
    const totalSecs = callList.reduce((acc, c) => acc + (c.duration_secs ?? 0), 0)
    if (totalSecs === 0) {
      results.push({ subscription_id: sub.id, skipped: 'no_unreported_calls' })
      continue
    }

    // Round up to whole minutes (Stripe usage records are integer quantities)
    const minutes = Math.ceil(totalSecs / 60)
    const callIds = callList.map((c) => c.id)

    try {
      // Idempotency key: per-subscription + run_id ensures retries don't double-push
      const idemKey = `usage_${sub.id}_${runId}`
      await postUsageRecord(sub.stripe_subscription_item_id as string, minutes, STRIPE_SECRET_KEY, idemKey)

      // Mark calls as reported
      const reportedAt = new Date().toISOString()
      const { error: updErr } = await supabaseAdmin
        .from('calls')
        .update({ reported_to_stripe_at: reportedAt })
        .in('id', callIds)
      if (updErr) {
        results.push({ subscription_id: sub.id, minutes, error: 'mark_reported_failed', detail: updErr.message })
        continue
      }

      results.push({
        subscription_id: sub.id,
        voice_agent_id: sub.voice_agent_id,
        minutes,
        total_secs: totalSecs,
        call_count: callIds.length,
        stripe_subscription_item_id: sub.stripe_subscription_item_id,
      })
      totalMinutesPushed += minutes
      subsWithUsage += 1
    } catch (e) {
      results.push({
        subscription_id: sub.id,
        minutes,
        error: 'stripe_push_failed',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return json({
    ok: true,
    run_id: runId,
    timestamp: new Date().toISOString(),
    subs_total: (subs ?? []).length,
    subs_with_usage: subsWithUsage,
    total_minutes_pushed: totalMinutesPushed,
    results,
  })
})
