# 32 — Implementation Decisions (Decision Record)

Status: implemented in code as of 2026-11-14. This file records what was actually built and why.

## D-01 Stack: Hono + Cloudflare Pages Functions + D1 (modular monolith)
- **Chosen:** Hono (TypeScript) API under `/api/v1`, served by a single Cloudflare Pages `_worker.js`; vanilla-JS SPA in `public/static/` (no client framework, no CDN runtime dependency except Clerk JS from the Clerk Frontend API).
- **Why:** repository had no code; Cloudflare-first was preferred by the brief; owner account already hosts Pages + D1; free tier covers MVP (Pages free requests, D1 free 5 GB / 5M reads/day / 100k writes/day as published by Cloudflare — re-verify before scale).
- **Trade-offs:** no React/Vite SPA build (lower complexity, smaller bundle, no build step for UI); routing done client-side with a tiny router. Revisit if UI complexity grows.

## D-02 Authentication: Clerk Production, verified server-side
- Production instance `ins_3M6aI0nGoe4sQ1EYQPr0GFuCJ1I`, domain `sandar.biz.id`, Frontend API `https://clerk.sandar.biz.id` (DNS CNAMEs verified resolving to Clerk on 2026-11-14).
- Browser obtains a short-lived session JWT via Clerk JS and sends `Authorization: Bearer`. The Worker verifies **RS256 signature (JWKS from issuer, cached)**, `iss`, `exp`/`nbf` with 10 s skew, and `azp` against `AUTHORIZED_PARTIES`. No Clerk SDK dependency — Web Crypto only (`src/lib/auth.ts`).
- User and workspace are derived from the verified `sub`; client-supplied IDs are ignored (tested).
- Bearer tokens (not cookies) on the API → no ambient-credential CSRF; an Origin check on writes adds defence in depth.
- `x-dev-user` stub works **only** when `ENVIRONMENT=development` (tested to be ignored otherwise).
- Clerk secret key is stored as a Cloudflare Pages secret; it is not required for JWT verification but reserved for future server-to-server calls (e.g. account deletion).

## D-03 Data: D1 `sandar-production`, versioned migrations
- `migrations/0001_initial_schema.sql`; money as INTEGER minor units; CHECK constraints for enums; indexes by `workspace_id, updated_at`.
- Public catalogue (`resource_listings`) is logically separated from private workspace tables; no join between them and user data.
- Rate limits, usage counters, provider daily caps, webhook idempotency are D1 tables (KV not used, keeping hosted-deploy compatibility).

## D-04 Agentic architecture = bounded deterministic workflows + optional AI
See docs/35. AI never does arithmetic, authorization, eligibility or freshness decisions.

## D-05 Providers (BYOK) are optional and capped
- Groq, Tavily, Firecrawl adapters in `src/providers/index.ts`: timeouts, one retry on 5xx/network, global daily caps (`PROVIDER_DAILY_CAPS`, default groq=200, tavily=30, firecrawl=10), per-user monthly quotas, purpose-specific consent, input redaction.
- Firecrawl is curator-only (admin endpoint) for drafting catalogue entries; never runs for end users and rejects non-https/IP/localhost URLs.
- **Apify and Scrape.ly are not integrated.** No concrete requirement justifies them; they remain disabled per cost/terms policy (docs/30). Their keys were not stored anywhere.
- Core functionality (catalogue, cash-flow, plans, deterministic agents) works with all providers disabled (tested).

## D-06 Catalogue seeding without fabrication
- Real publishers are seeded only as pointers to official homepages with status **unverified** and no programme claims. Fictional entries are prefixed `[CONTOH]` and flagged `is_sample`.
- A curator (Clerk user ID in `ADMIN_SUBJECTS`) can add entries; `checked` requires a verification date.

## D-07 Billing OFF, provider-neutral
See docs/33 and docs/34. `BILLING_ENABLED=false`, `PAYMENT_PROVIDER=none` in production. Mock gateway refuses to load in production.

## D-08 Security headers
CSP (`frame-ancestors 'none'`, `object-src 'none'`, scripts limited to self + Clerk FAPI + Turnstile), HSTS, nosniff, Referrer-Policy, Permissions-Policy, `cache-control: no-store` on every private API response; public catalogue responses `public, max-age=60` and never contain user data.

## D-09 Things intentionally deferred
Family Balance, wellbeing storage, reminders/notifications, bank connections, external submissions, R2 storage, organization tier, live payments.

## Unresolved conflicts / notes
- docs/16 lists `status (planned/expected/confirmed/paid)`; docs/27 lists `certainty (confirmed/estimated/unknown)`. Implemented docs/27 (`certainty`) as the data contract; payment status is out of MVP scope.
- Product category updated to "Agentic Life Navigation & Resilience OS" per owner override in the master prompt.
