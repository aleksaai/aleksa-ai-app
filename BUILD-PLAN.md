# BUILD-PLAN.md — AleksaAI App MVP

> Numbered execution steps for Claude Code. Each step has clear inputs, what to build, and acceptance criteria. Mark steps ✅ as you complete them. Update HANDOFF.md when ending a session mid-step.

**Phase:** MVP ("ChatDash kündbar")
**Estimated total:** 14–18h Claude Code work, ~3-4 sessions
**Owner:** Aleksa drives Claude Code; Marcus reviews

---

## Pre-flight (Aleksa, manual, ~30 min)

These need to happen ONCE before Step 1:

- [ ] **GitHub:** `gh repo create aleksaai/aleksa-ai-app --private --source=. --push` (oder manuell auf github.com)
- [ ] **Stripe Tax aktivieren:** Stripe Dashboard (Account 2) → Settings → Tax → Activate. Wähle Hungary als origin country. Für EU B2B: Reverse-Charge automatisch
- [ ] **Stripe API Keys holen:** Account 2 → Developers → API keys → kopiere `sk_live_...` (Secret) + `pk_live_...` (Publishable) → in `.env.local`
- [ ] **Stripe Webhook Endpoint provisorisch anlegen:** Stripe Dashboard → Developers → Webhooks → "Add endpoint" — Endpoint-URL kommt erst in Step 5, aber Signing-Secret schon mal kopieren in `.env.local` als `STRIPE_WEBHOOK_SECRET`
- [ ] **Resend API Key:** Resend-Dashboard → API Keys → Create → in `.env.local`

---

## Step 1 — Project scaffold + Auth shell (1.5h)

**Inputs:** SPEC.md, CLAUDE.md, .env.local

**Tasks:**
1. Vite scaffold: `pnpm create vite . --template react-ts` (in current empty dir)
2. Install: `pnpm add @supabase/supabase-js react-router-dom motion @stripe/stripe-js`
3. Install dev: `pnpm add -D tailwindcss postcss autoprefixer @types/node`
4. Tailwind setup: `npx tailwindcss init -p`, add `@tailwind` directives to `src/index.css`
5. Create `src/lib/supabase.ts` — Supabase client init mit `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
6. Create `src/lib/auth.tsx` — `AuthProvider` Context + `useAuth()` Hook (siehe `web-development.md` Pattern)
7. Create `src/components/RequireAuth.tsx` — wraps protected routes, redirects to `/` if unauthed
8. Create pages: `Login.tsx`, `Admin.tsx` (placeholder), `Dashboard.tsx` (placeholder)
9. Wire `App.tsx` mit Routes + `AuthProvider` + Lenis smooth scroll
10. Login.tsx: Magic-Link-Form (Email-Input → `supabase.auth.signInWithOtp({ email })`)
11. Vite config: `port: 5173`

**Acceptance:**
- [ ] `pnpm dev` startet, http://localhost:5173 zeigt Login-Page
- [ ] Aleksa gibt `info@aleksa.ai` ein, kriegt Magic-Link-Mail (Supabase default)
- [ ] Klick auf Magic-Link loggt ein, redirected zu `/admin`, zeigt "Welcome Aleksa, role: undefined" (profile noch nicht angelegt — kommt in Step 2)
- [ ] Logout-Button im Header funktioniert

---

## Step 2 — Database schema + RLS (1h)

**Inputs:** SPEC.md §4 (Daten-Modell)

**Tasks:**
1. Init Supabase Local: `supabase init` im Repo-Root
2. Migration anlegen: `supabase migration new initial_schema`
3. SQL aus SPEC.md §4 reinkopieren — alle 7 Tabellen + Constraints + Indexes
4. RLS-Policies pro Tabelle:
   ```sql
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT
     USING (auth.uid() = id);
   CREATE POLICY "admin_full_access" ON profiles FOR ALL
     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
   -- ...analog für customers, voice_agents, pricing_plans, customer_subscriptions, calls, customer_invitations
   ```
5. Trigger `handle_new_user()`: nach Signup automatisch Row in `profiles` anlegen mit role = 'customer_owner' (Default; admin wird manuell promoted)
6. Manuelle Migration: Aleksas Profile-Row updaten auf `role = 'admin'`:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = '<aleksa-uuid>';
   ```
7. Generate types: `supabase gen types typescript --project-id puimwizupgkdvxpanlhy > src/types/db.ts`
8. Push Migration: `supabase db push --project-ref puimwizupgkdvxpanlhy`

**Acceptance:**
- [ ] Alle 7 Tabellen sichtbar im Supabase Studio
- [ ] RLS aktiv (lock-icon)
- [ ] Aleksas `profiles.role = 'admin'`
- [ ] `src/types/db.ts` hat alle Tabellen-Types
- [ ] Test-Insert via Supabase Studio (als Aleksa) in `customers` funktioniert; als anon User schlägt fehl

---

## Step 3 — Stripe-Setup + Test-Mode-Dummy-Run (30 min, mostly UI)

**Inputs:** Stripe Dashboard, Account 2

**Tasks:**
1. Stripe Tax: nochmal verifizieren dass es ON ist (Pre-flight Step)
2. Customer Portal konfigurieren: Stripe → Settings → Billing → Customer Portal
   - Branding: Logo + Color (kann später wieder geändert werden)
   - Features: Invoice history ON, Payment methods management ON, Cancel subscription OFF (wir wollen Cancellation über Aleksa kontrollieren)
3. Test-Run im Stripe-Dashboard:
   - Erstelle manuell einen Test-Customer in Stripe
   - Erstelle Test-Product "Test Pricing Plan", Test-Price (15 EUR/Monat recurring + Metered overage)
   - Erstelle Subscription manuell, attach Test-Card `4242 4242 4242 4242`
   - Verify: Invoice generiert, Tax wird ausgewiesen
4. Note dir die exakten API-Felder die du gesehen hast — wir verwenden die in Step 6/7

**Acceptance:**
- [ ] Stripe Tax sichtbar AN auf Test-Invoice
- [ ] Customer Portal accessible via generated link
- [ ] Tiered Metered Pricing-Modell funktioniert in Test-Mode

---

## Step 4 — Customer-CRUD im Admin-Panel (2h)

**Inputs:** Step 1-3 done

**Tasks:**
1. Admin-Page Layout bauen: Sidebar (Customers / Pricing Plans / Calls) + Main Content
2. Use `magic_component_inspiration` für Admin-Layout: search "admin sidebar dashboard layout" → adapt to project tokens
3. `/admin` zeigt Customer-Liste (table) — empty state OK
4. `/admin/customers/new` Form: Name + Email
5. Edge Function `admin-create-customer`:
   - Auth: only role='admin' can call (verify via service role + lookup profile)
   - Erstellt Stripe-Customer via Stripe API
   - Insert into `customers` table
   - Generiert `customer_invitations` Token (uuid, expires in 7 days)
   - Sendet Resend-Email mit Link `app.aleksa.ai/invite/<token>`
6. Wire Form → calls Edge Function → on success: redirect zurück zu `/admin`
7. Customer-List Row mit Stripe-Customer-ID + Invitation-Status-Badge

**Acceptance:**
- [ ] Aleksa lädt sich selbst als Test-Customer ein (zweite Email-Adresse)
- [ ] Email kommt an mit Invite-Link
- [ ] Customer-Row erscheint in `/admin` mit "pending invitation" Badge

---

## Step 5 — Customer-Onboarding-Flow + Paywall (2h)

**Inputs:** Step 4 done

**Tasks:**
1. `/invite/:token` Route: Edge Function `accept-invitation`:
   - Validiert Token (existiert, not used, not expired)
   - Sends Magic-Link via `supabase.auth.signInWithOtp` to invitation.email
   - On Magic-Link-Click → User wird in `auth.users` angelegt
   - Trigger `handle_new_user`: `profiles` Row mit `role = 'customer_owner'`, `customer_id = invitation.customer_id`
   - Markiert Invitation als used
2. Customer wird redirected zu `/onboarding` (nicht `/dashboard` — wegen Paywall)
3. `/onboarding`: Stripe Setup-Intent UI mit Stripe Elements
   - Edge Function `setup-intent`: erstellt `SetupIntent` für Customer's Stripe-Customer-ID
   - Frontend nutzt `@stripe/stripe-js` für Card-Element
   - Bei Success: redirect zu `/dashboard`
4. Stripe Webhook handler `webhook-stripe`:
   - Listen for `setup_intent.succeeded` → update `customers.has_payment_method = true`
   - Listen for `customer.subscription.updated` → update `customer_subscriptions.status`
   - Listen for `invoice.paid` / `invoice.payment_failed` → update status
5. `/dashboard` Page:
   - Wenn `!customer.has_payment_method` → Paywall-Overlay mit "Bitte Zahlungsmethode hinterlegen" + Redirect-Button zu `/onboarding`
   - Wenn `has_payment_method = true` → leere Welcome-Page mit Stripe-Customer-Portal-Link

**Acceptance:**
- [ ] Test-Customer akzeptiert Invitation, kann sich einloggen
- [ ] `/onboarding` zeigt Stripe-Card-Element
- [ ] Test-Karte `4242 4242 4242 4242` wird akzeptiert
- [ ] `customers.has_payment_method` flippt auf true (verify in Supabase Studio)
- [ ] `/dashboard` zeigt Welcome-Page (keine Paywall mehr)

---

## Step 6 — Pricing-Plans CRUD (2h)

**Inputs:** Step 3 done

**Tasks:**
1. `/admin/pricing-plans` Page mit Liste + "New Plan" Button
2. Form mit Type-Switcher (per_minute / flat / hybrid). Felder conditional anzeigen:
   - **per_minute:** `per_minute_overage_cents` (z.B. 18 = 18ct)
   - **flat:** `flat_amount_cents` (z.B. 20000 = 200€)
   - **hybrid:** `flat_amount_cents` + `included_minutes` + `per_minute_overage_cents`
3. Edge Function `admin-create-pricing-plan`:
   - Stripe Product anlegen
   - Pro Plan-Type entsprechende Stripe Price(s):
     - `per_minute`: 1 metered Price (per_unit pricing model, billed per minute)
     - `flat`: 1 recurring Price (monthly, fixed amount)
     - `hybrid`: 2 Prices — recurring flat + metered tiered (tier 1: free up to `included_minutes`, tier 2: `per_minute_overage_cents` per minute)
   - Schreibt `stripe_product_id`, `stripe_flat_price_id`, `stripe_metered_price_id` zurück in DB

**Acceptance:**
- [ ] Aleksa erstellt einen Plan jedes Typs:
  - "Standard 18ct/min" (per_minute)
  - "Premium Flat 200€" (flat)
  - "Hybrid 300€+100min+30ct" (hybrid)
- [ ] Alle 3 Plans sichtbar in Stripe Products + DB

---

## Step 7 — Voice-Agent + Subscription-Start (2h)

**Inputs:** Step 4-6 done

**Tasks:**
1. `/admin/customers/:id` Detail-Page mit Voice-Agents-Liste
2. "Add Voice Agent" Form: `display_name`, `elevenlabs_agent_id`, optional `elevenlabs_phone_number_id`
3. Insert into `voice_agents` Table
4. Per Voice-Agent-Row: Dropdown "Assign Pricing Plan"
5. Edge Function `admin-assign-pricing`:
   - Erstellt Stripe Subscription für Customer mit den Price-IDs des gewählten Plans
   - Für hybrid: 2 SubscriptionItems (flat + metered)
   - Speichert `stripe_subscription_id` + `stripe_subscription_item_id` (das metered) in `customer_subscriptions`
   - Aktiviert sofort (nicht "trialing" — wir geben keine Free-Trials)

**Acceptance:**
- [ ] Aleksa fügt Kati's Agent (`agent_2601kpdeebt1f96s1790bm35n8rk`) zum VV-Cars-Customer
- [ ] Aleksa weist "Hybrid 300€+100min+30ct" zu
- [ ] Stripe Subscription erscheint im Stripe-Dashboard, Status `active`
- [ ] `customer_subscriptions` Row hat alle IDs

---

## Step 8 — ElevenLabs Webhook handler (2h)

**Inputs:** ElevenLabs Webhook docs + bestehender Kati-Agent

**Tasks:**
1. Edge Function `webhook-elevenlabs`:
   ```typescript
   // 1. Read raw body
   // 2. Verify HMAC: header `elevenlabs-signature` against ELEVENLABS_WEBHOOK_HMAC_SECRET
   //    (use crypto.subtle.verify with HMAC-SHA256 over rawBody)
   // 3. Parse JSON
   // 4. Extract: data.agent_id, data.conversation_id, data.metadata.start_time_unix_secs,
   //    data.metadata.call_duration_secs, data.metadata.cost, data.metadata.termination_reason
   // 5. Lookup voice_agents by elevenlabs_agent_id → get voice_agent.id + customer_id
   // 6. INSERT INTO calls (... ON CONFLICT (elevenlabs_conversation_id) DO NOTHING)
   //    → idempotent: re-firings sind no-ops
   // 7. Return 200 OK
   ```
2. Deploy: `supabase functions deploy webhook-elevenlabs --no-verify-jwt`
3. ElevenLabs Dashboard → Kati Agent → Settings → Webhook URL setzen auf:
   `https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/webhook-elevenlabs`
4. ElevenLabs generiert HMAC Secret → in `.env.local` UND als Supabase Secret setzen
5. Test mit Test-Webhook von ElevenLabs Dashboard (sollten den haben)

**Acceptance:**
- [ ] Test-Webhook landed in `calls`-Table mit korrekten Werten
- [ ] Re-firing des gleichen Webhooks erzeugt KEINE Duplikate
- [ ] Echter Anruf bei +49 2271 4812990 erscheint in `calls` nach Beendigung

---

## Step 9 — Daily Cron für Stripe Usage Reporting (1.5h)

**Inputs:** Step 7-8 done

**Tasks:**
1. Edge Function `cron-stripe-usage`:
   ```typescript
   // 1. SELECT * FROM customer_subscriptions WHERE status = 'active'
   // 2. Pro subscription:
   //    - SELECT SUM(duration_secs) / 60 AS minutes, ARRAY_AGG(id) AS call_ids
   //      FROM calls
   //      WHERE voice_agent_id = subscription.voice_agent_id
   //      AND reported_to_stripe_at IS NULL
   //    - If minutes > 0:
   //      - POST Stripe usage_record:
   //        stripe.subscriptionItems.createUsageRecord(
   //          subscription.stripe_subscription_item_id,
   //          { quantity: ceil(minutes), timestamp: now, action: 'increment' }
   //        )
   //      - UPDATE calls SET reported_to_stripe_at = now() WHERE id = ANY(call_ids)
   ```
2. Deploy: `supabase functions deploy cron-stripe-usage`
3. pg_cron schedule:
   ```sql
   SELECT cron.schedule(
     'stripe-usage-daily',
     '0 2 * * *',  -- 02:00 UTC
     $$SELECT net.http_post(
       url := 'https://puimwizupgkdvxpanlhy.supabase.co/functions/v1/cron-stripe-usage',
       headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>')
     )$$
   );
   ```
4. Manuell triggern: `supabase functions invoke cron-stripe-usage`

**Acceptance:**
- [ ] Manueller Trigger nach 2-3 Test-Anrufen → Stripe-Subscription zeigt usage records
- [ ] Calls haben `reported_to_stripe_at` gesetzt
- [ ] Re-Trigger zeigt 0 Updates (idempotent)
- [ ] Cron läuft automatisch um 02:00 UTC am nächsten Tag

---

## Step 10 — End-to-End-Migration: VV-Cars von ChatDash → AleksaAI App (1h)

**Inputs:** Steps 1-9 ALL done

**Tasks:**
1. Aleksa lädt Vierroth (oder seine Test-Email) als Customer ein, durchläuft Onboarding mit echter Karte
2. Aleksa fügt Kati als Voice-Agent dem VV-Cars-Customer hinzu
3. Aleksa setzt Pricing-Plan auf das gleiche Modell wie aktuell in ChatDash
4. **Ruhiges Wartungsfenster wählen** (Sonntag früh oder so)
5. ElevenLabs Dashboard → Kati Agent → Webhook URL umstellen von ChatDash auf AleksaAI App
6. Aleksa macht Test-Anruf bei `+49 2271 4812990`
7. Verify: Call landet in `calls`-Table (sollte ~1 Min nach Anruf-Ende erscheinen)
8. Manuell `cron-stripe-usage` triggern, prüfen dass usage record in Stripe erscheint
9. Warten bis nächster Stripe-Periodenwechsel → Auto-Invoice prüfen

**Acceptance:**
- [ ] Echter VV-Cars-Anruf wird in AleksaAI App erfasst
- [ ] Stripe-Invoice am Periodenende stimmt
- [ ] **ChatDash-Abo gekündigt** ✅ (das ist das Hauptziel!)

---

## Post-MVP (V1 + V2)

V1 (Customer-Selfservice am Voice Agent): siehe SPEC.md §3 V1. Separater Build-Plan wenn MVP live.

V2 (Whitelabel-Subdomain + Custom-Branding): siehe SPEC.md §3 V2. Erst wenn 3+ Customers live sind und der Need klar ist.

---

## Marcus' Notes

- **Sequenzielle Steps:** 1 → 2 → 3 (parallel zu 1+2 möglich) → 4 → 5 → 6 (parallel zu 4+5 möglich) → 7 → 8 → 9 → 10
- **Optimistische Reihenfolge bei mehreren Sessions:**
  - Session 1 (4-5h): Steps 1, 2, 3 (Pre-flight + Scaffold + Schema + Stripe-Setup)
  - Session 2 (4-5h): Steps 4, 5 (Customer-CRUD + Onboarding-Flow)
  - Session 3 (4-5h): Steps 6, 7, 8 (Pricing + Subscription + Webhook)
  - Session 4 (2-3h): Steps 9, 10 (Cron + Live-Migration)
- **Vor Step 8/10:** Vierroth informieren dass es ein kurzes Migrations-Fenster gibt
- **Keep ChatDash live until Step 10 complete + 1 week of overlap** — wir wollen nicht in einem broken state sein wenn was schief geht
