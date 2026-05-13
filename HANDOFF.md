# HANDOFF.md — AleksaAI App

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-13** — Marcus (Session-Close: Step 1+2 Code done + zu GitHub gepusht, Token-Bug gefixed, awaiting Netlify + SQL-Exec von Aleksa)

## Current state

🟡 **Step 1 + 2 Code complete, awaiting Aleksa: SQL-Migration ausführen + Netlify connecten**

**Nicht versuchen:** lokales `npm run dev` oder `preview_start`. Auf Aleksas MacBook (User `aleksaspalevic`) ist Node NICHT installiert — Frontend wird ausschließlich über Netlify gebaut + getestet. Siehe Marcus knowledge.md "Node-loses Development auf Aleksas MacBook".

### Phase 1 ✅
- Spec approved + Build-Plan geschrieben
- Repo erstellt mit allen Standard-Files
- GitHub-Repo `aleksaai/aleksa-ai-app` aktiviert
- Stripe Tax in Account 1 aktiviert (Aleksa's Entscheidung — Voice-Agent-Customers laufen über Account 1, getaggt mit `metadata: source=aleksa-ai-app` für Lisa-Filterung)
- Stripe Customer Portal konfiguriert
- Resend API Key in neuem Supabase als Secret gespeichert

### Step 1 — done so far
- ✅ `package.json` mit allen MVP-Dependencies (React 18, Vite 5, Tailwind 3, Supabase, Stripe, Motion, React Router)
- ✅ Vite + TS + Tailwind config files
- ✅ `index.html` + `src/main.tsx` mit `BrowserRouter` + `AuthProvider` Wrapper
- ✅ `src/lib/supabase.ts` — Supabase client init
- ✅ `src/lib/auth.tsx` — `AuthProvider` Context, lädt `profiles`-Row wenn user logged in
- ✅ `src/components/RequireAuth.tsx` — Route-Wrapper mit optional `requireRole`
- ✅ `src/pages/Login.tsx` — Magic-Link-Form mit Motion-Animationen
- ✅ `src/pages/Admin.tsx` + `src/pages/Dashboard.tsx` — Placeholder-Pages
- ✅ `src/App.tsx` — Routes mit role-based redirect (`/` → Login OR `/admin` OR `/dashboard`)
- ✅ Tailwind theme mit `brand` color palette (#66A4FF) + Inter font
- ✅ Shared component classes in `index.css` (`.btn-primary`, `.input`, `.card`)

### Step 1 — done (alles Code-mässig, ohne lokales Preview)
- ✅ Code geschrieben + zu GitHub gepusht (3 Commits auf main)
- Build wird auf Netlify passieren, nicht lokal

### Step 2 — SQL written, awaiting Aleksa execution
- ✅ `supabase/migrations/001_initial_schema.sql` — 7 Tabellen + RLS-Policies + handle_new_user Trigger + Helper-Functions
- ⏳ Aleksa: im Supabase Dashboard SQL Editor paste + Run
- ⏳ Aleksa: nach erstem Magic-Link-Login das eigene Profile zu admin promoten:
  ```sql
  update profiles set role = 'admin' where id = (select id from auth.users where email = 'info@aleksa.ai');
  ```

## What's next (Aleksa pending)

1. **SQL-Migration ausführen:** Supabase Dashboard `puimwizupgkdvxpanlhy` → SQL Editor → paste content of `supabase/migrations/001_initial_schema.sql` (RAW von GitHub holen) → Run
2. **Netlify connecten:**
   - Add new site → Import from GitHub → `aleksaai/aleksa-ai-app`
   - Build: `npm run build` / Publish: `dist`
   - Env vars: `NODE_VERSION=22`, `VITE_SUPABASE_URL=https://puimwizupgkdvxpanlhy.supabase.co`, `VITE_SUPABASE_ANON_KEY=<aus Supabase Dashboard → Settings → API>`
3. **Marcus in nächster Session:** öffnet Netlify-URL im Browser via Chrome-MCP-Tool → verifiziert Login-Page rendert
4. **Aleksa:** Magic-Link-Test mit `info@aleksa.ai` auf der Netlify-URL → Profile zu admin promoten via SQL → Login bestätigt
5. Wenn alles ✅ → Step 3 + 4 starten (Stripe-Setup-Verification + Customer-CRUD im Admin)

## Decisions made

- **Naming:** `aleksa-ai-app` (Repo) + `app.aleksa.ai` (Subdomain). Brand bleibt "AleksaAI"
- **Supabase:** separates Projekt unter `aleksa@spalevic-consulting.de` Account, NICHT claude-team's Supabase
- **Stripe Account 1** (`acct_1RlQZ6JH4KmjuYHx`) — Aleksas Wahl; Voice-Agent-Subscriptions kriegen `metadata: source=aleksa-ai-app` für Lisa
- **GitHub Token:** im Browser auf "All repositories" gesetzt (oder zumindest aleksa-ai-app hinzugefügt) — Push klappt
- **Resend Key:** als Secret im neuen Supabase hinterlegt
- **Stripe Tax aktiviert** + Customer Portal konfiguriert
- **Lokales Node:** NICHT installiert auf MacBook. Build-Pattern via Netlify-Cloud, kein lokales `npm run dev`
- **Stripe Tax:** AN
- **Stripe Pricing-Modell:** Tiered Metered Billing
- **Customer-Selfservice am Voice Agent:** kommt in V1
- **Subdomain pro Customer:** kommt in V2

## Decisions made

- **Naming:** `aleksa-ai-app` (Repo) + `app.aleksa.ai` (Subdomain). Brand bleibt "AleksaAI"
- **Supabase:** separate Projekt unter `aleksa@spalevic-consulting.de` Account, NICHT claude-team's Supabase. Sauberer Trust-Boundary für Customer-Daten
- **Stripe Tax:** AN (0.5% extra pro Tx, spart EU-B2B-Reverse-Charge-Compliance-Aufwand)
- **Stripe Pricing-Modell:** Tiered Metered Billing (eine Subscription mit flat + metered Components)
- **Customer-Selfservice am Voice Agent:** kommt in V1, NICHT im MVP
- **Subdomain pro Customer:** kommt in V2, NICHT im MVP

## Open questions

— keine offenen Fragen aktuell. Alle Discovery-Punkte sind in SPEC.md geklärt.

## Risks / WIP / Blockers

- Aleksa muss noch Stripe Tax aktivieren (Step 3 im Build-Plan blockiert sonst)
- Aleksa muss GitHub-Repo `aleksaai/aleksa-ai-app` anlegen vor Push
- ChatDash-Migrations-Cutover (Step 10) braucht ein ruhiges Wartungsfenster — VV-Cars/Vierroth muss informiert werden bevor wir den ElevenLabs-Webhook umschalten
