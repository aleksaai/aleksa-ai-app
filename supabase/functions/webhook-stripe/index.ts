// webhook-stripe Edge Function
// Receives events from Stripe and updates customers + customer_subscriptions accordingly.
// Verifies HMAC signature with STRIPE_WEBHOOK_SECRET before doing anything.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=denonext'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  // @ts-expect-error — newer stripe-node infers apiVersion automatically
  httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const signature = req.headers.get('Stripe-Signature')
  if (!signature) return json({ error: 'missing_signature' }, 400)

  const rawBody = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )
  } catch (err) {
    console.error('Signature verification failed:', err)
    return json({ error: 'invalid_signature', detail: String(err) }, 400)
  }

  try {
    switch (event.type) {
      // ── Payment Method ──
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent
        const customerId = setupIntent.customer as string
        const paymentMethodId = setupIntent.payment_method as string | null
        if (!customerId) break

        // 1. Mark customer as having a payment method in our DB
        await supabaseAdmin
          .from('customers')
          .update({ has_payment_method: true })
          .eq('stripe_customer_id', customerId)

        // 2. Set the payment method as the customer's default for invoices.
        //    Without this, future subscription.create calls fail with
        //    'no attached payment source or default payment method'.
        if (paymentMethodId) {
          try {
            await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')!}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                'invoice_settings[default_payment_method]': paymentMethodId,
              }),
            })
          } catch (e) {
            console.error('Failed to set default payment method:', e)
          }
        }
        break
      }

      // ── Subscription Lifecycle ──
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status as
          | 'active'
          | 'past_due'
          | 'canceled'
          | 'trialing'
          | 'incomplete'
          | 'incomplete_expired'
          | 'unpaid'

        // Map Stripe statuses to our enum
        const mappedStatus =
          status === 'incomplete_expired' || status === 'unpaid'
            ? 'canceled'
            : status === 'active' ||
              status === 'past_due' ||
              status === 'canceled' ||
              status === 'trialing' ||
              status === 'incomplete'
            ? status
            : 'incomplete'

        await supabaseAdmin
          .from('customer_subscriptions')
          .update({
            status: mappedStatus,
            current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
            current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      // ── Invoicing ──
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = (invoice as any).subscription as string | null
        if (!subId) break
        // Stripe will subsequently fire customer.subscription.updated with the
        // new subscription status — we just log here for traceability.
        console.log(`Invoice ${invoice.id} ${event.type} for subscription ${subId}`)
        break
      }

      default:
        // Unhandled — fine, Stripe stops retrying after we 200 anyway.
        console.log(`Unhandled event type: ${event.type}`)
    }

    return json({ received: true, type: event.type, id: event.id })
  } catch (err) {
    console.error('Event processing failed:', err)
    return json({ error: 'processing_failed', detail: String(err) }, 500)
  }
})
