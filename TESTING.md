# TESTING.md — End-to-End Test Plan

> Walk through this list to validate every flow before live customer migration. Each section is a focused test scenario.

## Pre-Test Setup

Make sure you have:
- [ ] Admin login working: `app.aleksa.ai` → `info@aleksa.ai`
- [ ] A test customer Stripe-test-card ready: `4242 4242 4242 4242`, any future date, any CVC
- [ ] An ElevenLabs Test-Agent that you can call (e.g. Translator DE-HU or any with a phone number)
- [ ] Access to ElevenLabs Dashboard for verification

---

## Test 1 — Admin Login + Navigation

| Step | Expected |
|---|---|
| 1.1 Open `app.aleksa.ai/` | Login page renders, no console errors |
| 1.2 Enter `info@aleksa.ai` → "Magic-Link senden" | Success state "Magic-Link gesendet ✓" |
| 1.3 Check inbox + click Magic Link | Redirects to `/admin`, top-nav shows 4 tabs: Kunden / Agenten / Integrationen / Pricing-Pakete |
| 1.4 Click each tab | Page loads, no errors |

---

## Test 2 — Integration Setup

| Step | Expected |
|---|---|
| 2.1 `/admin/integrations` → "+ Neue Integration" | Modal: 4 provider cards |
| 2.2 Choose ElevenLabs | Form: Name + API Key + Region toggle US/EU |
| 2.3 Submit | Card appears with platform badge + region badge |
| 2.4 Verify in DB | `select * from integrations` returns row with API key |

---

## Test 3 — Pricing-Plans CRUD (all 3 modes)

For each mode (Grundabo+Nutzung, Nur Nutzungsbasiert, Einmalig):

| Step | Expected |
|---|---|
| 3.1 `/admin/pricing-plans` → "+ Neues Paket" | Modal with 3-radio mode selector |
| 3.2 Pick mode, fill fields | Submit |
| 3.3 Verify in Stripe Dashboard → Products | New product with `metadata: { source: aleksa-ai-app, type: <mode> }` |
| 3.4 For hybrid/per_minute: verify 2 prices (flat + tiered metered) for hybrid, 1 metered for per_minute | |
| 3.5 For one_time: verify 1 non-recurring price | |

---

## Test 4 — Customer Onboarding (B2C)

| Step | Expected |
|---|---|
| 4.1 `/admin` → "+ Neuer Customer" | Form |
| 4.2 Fill: Name "Test B2C", email (use a real address you control) | Submit |
| 4.3 Modal shows "Customer angelegt ✓" + Invite-Link + email_sent: true | |
| 4.4 Check email inbox | Resend invitation arrives with subject "Einladung zur AleksaAI App" |
| 4.5 Click invite link | `/invite/<token>` shows Welcome page |
| 4.6 Click "Magic-Link senden" | Supabase OTP email arrives |
| 4.7 Click Supabase magic link | Lands on `/onboarding` |
| 4.8 Select "Privatperson" | No business fields shown |
| 4.9 Fill address (any DE address) + Stripe test card | Click "Karte hinterlegen" |
| 4.10 Redirect to `/dashboard` | Shows "Customer Dashboard" placeholder (no agents yet) |
| 4.11 As admin: verify `customers.has_payment_method = true` + Stripe Customer has default_payment_method | |

---

## Test 5 — Customer Onboarding (B2B with VAT)

| Step | Expected |
|---|---|
| 5.1 Repeat 4.1-4.7 with new test customer | |
| 5.2 In Onboarding: select "Unternehmen" | Business name + VAT ID fields appear |
| 5.3 Enter "Test GmbH" + `DE811107811` (real SAP VAT, validates) | |
| 5.4 Fill DE address + test card → submit | |
| 5.5 As admin: verify Stripe Customer | Has `name: "Test GmbH"`, `address.country: DE`, `tax_ids[0].value: DE811107811`, `verification.status: verified` |
| 5.6 Try with invalid VAT (e.g. `DE000000000`) | Should fail with `vat_id_rejected_by_stripe` |

---

## Test 6 — Voice-Agent Assignment

| Step | Expected |
|---|---|
| 6.1 `/admin/customers/:id` for B2C customer → "+ Voice-Agent" | Modal |
| 6.2 Select integration | Agents-dropdown auto-loads from ElevenLabs API |
| 6.3 Pick an agent | Display-Name auto-fills, phone-id shown if assigned |
| 6.4 Submit | Agent appears in Voice-Agents-Liste with "+ Pricing zuweisen" button |
| 6.5 Click "+ Pricing zuweisen" → pick hybrid plan → Subscription starten | Plan badge appears, status "active" |
| 6.6 Stripe Dashboard → Subscriptions | New active subscription with 2 items (flat + metered) and metadata `source=aleksa-ai-app` |
| 6.7 Verify in DB | `customer_subscriptions` row has both `stripe_subscription_id` and `stripe_subscription_item_id` |

---

## Test 7 — Live Voice-Agent Call → Billing Pipeline

| Step | Expected |
|---|---|
| 7.1 Call the agent's phone number with a real device | Agent answers |
| 7.2 Have a short conversation (10-30 sec) and hang up | |
| 7.3 Wait ~10 sec | `webhook-elevenlabs` should fire |
| 7.4 As admin: `select * from calls order by created_at desc limit 1` | Row exists with correct conversation_id + duration_secs + termination_reason |
| 7.5 As customer: `/dashboard` → expand agent card | Calls log shows the call |
| 7.6 Manually trigger cron: `curl -X POST app.aleksa.ai/functions/v1/cron-stripe-usage -H "x-cron-secret: $SECRET"` | Returns `{results: [...]}` with minutes pushed |
| 7.7 DB check: `select reported_to_stripe_at from calls` | NOT NULL |
| 7.8 Stripe Dashboard → Subscription Item → Usage records | Shows the pushed quantity |

---

## Test 8 — Customer-Selfservice (Permissions)

| Step | Expected |
|---|---|
| 8.1 As admin: open Customer → "Kundenzugriff" → enable `can_edit_agent_config` | |
| 8.2 As customer (incognito): `/dashboard` → "Agent konfigurieren →" button visible | |
| 8.3 Click → `/dashboard/agents/:id` | 3 tabs: Übersicht, Prompt, Stimme |
| 8.4 Edit Prompt → Save | "✓ Gespeichert" pill appears |
| 8.5 Verify in ElevenLabs Dashboard → Agent has updated prompt | |
| 8.6 As admin: enable `can_edit_kb` | |
| 8.7 As customer: refresh → 4th tab "Wissensdatenbank" appears | |
| 8.8 Create a new KB doc + assign + enable RAG → Save | Verify in ElevenLabs Workspace |
| 8.9 As admin: DISABLE `can_edit_agent_config` | |
| 8.10 As customer refresh `/dashboard/agents/:id` | Prompt + Stimme tabs hidden, only Übersicht + Wissensdatenbank |

---

## Test 9 — Call-Detail (Transcript + Audio)

| Step | Expected |
|---|---|
| 9.1 As admin: enable `can_view_calls + can_view_transcripts + can_view_audio` for customer | |
| 9.2 As customer: `/dashboard` → expand agent → click call row | `/dashboard/calls/:id` |
| 9.3 Metadata card shows: Datum + Dauer + Agent + Beendet-weil | |
| 9.4 Summary card shows ElevenLabs analysis transcript_summary (if available) | |
| 9.5 Click "▶ Audio laden" → wait ~2s | Audio player appears with playable audio |
| 9.6 Transcript card shows turns as chat bubbles (Agent left, Anrufer right) with mm:ss time markers | |
| 9.7 Disable `can_view_audio` → refresh | Audio card disappears |
| 9.8 Disable `can_view_transcripts` → refresh | Transcript card shows "nicht freigeschaltet" message |

---

## Test 10 — View as Customer (Admin Preview)

| Step | Expected |
|---|---|
| 10.1 As admin: `/admin/customers/:id` → click "👁 Als Customer ansehen →" | |
| 10.2 Lands on `/admin/customers/:id/view` | Renders customer's dashboard with amber banner "Admin-View" |
| 10.3 "Abo verwalten" button is disabled | (would otherwise open admin's own Stripe portal — confusing) |
| 10.4 Click "← Zurück zum Admin" | Returns to customer detail |

---

## Test 11 — Stripe Tax (Reverse-Charge)

Verify a real test invoice shows correct VAT for each scenario:

| Customer setup | Expected MwSt on invoice |
|---|---|
| HU → HU B2C | 27% HU-MwSt |
| HU → DE B2C (no VAT) | 19% DE-MwSt |
| HU → DE B2B with valid VAT | **0% Reverse-Charge** (line: "Reverse-Charge — Steuerschuldnerschaft des Leistungsempfängers") |
| HU → CH B2C | 0% (Switzerland not in EU VAT scope) |

To test: change Customer's address in Stripe Dashboard, then trigger an Invoice manually (Stripe Test Mode → Customer → Create Invoice).

---

## Test 12 — Edge Cases / Failure Modes

| Scenario | Expected |
|---|---|
| Customer enters invalid VAT format (e.g. `DE123`) | Error: `vat_id_invalid_format` |
| Customer enters non-existing VAT (e.g. `DE000000000`) | Error: `vat_id_rejected_by_stripe` (VIES rejected) |
| Webhook from ElevenLabs with unregistered agent_id | 200 OK with `ignored: 'unregistered_agent'` (Stripe stops retrying) |
| Webhook with invalid HMAC | 400 `invalid_signature` |
| Customer with no payment method tries to assign pricing | Block at admin-assign-pricing: `no_payment_method` |
| Two simultaneous subscription assignments for same agent | 409 `subscription_already_exists` |
| Subscription create with customer that has no address | 400 `customer_tax_location_invalid` (was the original bug, now fixed by AddressElement in Onboarding) |
| Customer tries to call admin-update-agent-config without permission | 403 `permission_denied` |
| Customer tries to view another customer's call detail | 403 `forbidden` |

---

## Migration Test (when ready to go live with VV-Cars)

> Aleksa: do NOT run this until you're confident in MVP. ChatDash stays parallel for 1 week of overlap.

1. Switch from Stripe Test Mode → Live Mode (replace keys in Supabase Secrets)
2. Stripe Webhook endpoint URL: switch from Stripe Test Webhook to Live Webhook (note: signing secret changes too)
3. Re-verify Stripe Tax is enabled in Live mode
4. Invite Vierroth (VV-Cars) as customer via `/admin/customers/new`
5. He completes onboarding with real card + VAT ID
6. Assign Kati (`agent_2601kpdeebt1f96s1790bm35n8rk`) + appropriate pricing plan
7. In ElevenLabs Dashboard → Kati → switch webhook from ChatDash URL to `webhook-elevenlabs` URL
8. Make a real test call
9. Wait 24h → verify cron-stripe-usage pushed his minutes
10. Wait until period end → verify Stripe charges his card
11. After 1 week of overlap with ChatDash running in parallel: cancel ChatDash subscription. 🎉

---

## What to Check When Things Break

| Symptom | Where to look |
|---|---|
| Generic "Edge Function returned a non-2xx status code" in UI | Open browser DevTools → Network → click the function call → Response tab shows the actual error body |
| Webhook not firing | Stripe Dashboard → Webhooks → click endpoint → Events log shows attempts + status |
| ElevenLabs webhook not firing | ElevenLabs → Conversational AI → Settings → Webhooks → check delivery log |
| Frontend build fail on Netlify | Netlify Dashboard → Deploys → click failed deploy → Logs (usually TS errors or missing env var) |
| Supabase Edge Function error logs | Supabase Dashboard → Edge Functions → click function → Logs tab |
| Stripe API error in our code | Search the function logs for "Stripe " — error messages have request_log_url linking to Stripe's request log |
