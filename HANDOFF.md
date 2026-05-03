# HANDOFF.md — AleksaAI App

> Cross-session + cross-device onboarding. Read this when picking up work. Update at end of each session.

## Last update

**2026-05-03** — Marcus (Phase 1: Project setup done)

## Current state

🔵 **Phase 1 done — ready for Build (MVP Step 1)**

- ✅ Spec approved by Aleksa (`SPEC.md`)
- ✅ Local repo created at `~/Desktop/Projects/aleksa-ai-app/`
- ✅ Supabase project erstellt (`puimwizupgkdvxpanlhy`, Account `aleksa@spalevic-consulting.de`) mit RLS-auto-on
- ✅ `BUILD-PLAN.md` mit 10 numbered MVP steps geschrieben
- ✅ Standard files in repo: SPEC.md, CLAUDE.md, HANDOFF.md, README.md, .env.example, .env.local (gitignored), .gitignore
- ⏳ Aleksa: GitHub-Repo `aleksaai/aleksa-ai-app` erstellen + lokales Repo connecten + erste Pushup
- ⏳ Aleksa: Stripe Tax in Account 2 aktivieren (UI-Click)
- ⏳ Aleksa: Stripe Customer Portal konfigurieren (Branding für app.aleksa.ai)

## What's next

**Step 1 of `BUILD-PLAN.md`** — Vite-Scaffold + Supabase-Client + Auth-Shell + Magic-Link-Login.

Aleksa öffnet eine neue Claude Code Session in diesem Verzeichnis und sagt:
> "Marcus, leg los mit Step 1 aus BUILD-PLAN.md."

Marcus dann: spec/build-plan reading → execution → acceptance check → HANDOFF.md updaten.

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
