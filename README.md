# SANDAR

**Agentic Life Navigation & Resilience OS**

SANDAR is a privacy-first, user-directed system that helps people understand a question or goal they choose, organize only the information needed, navigate trustworthy public resources and opportunities, and prepare for uncertainty.

SANDAR is a life-navigation system delivered through a lightweight web/PWA experience—not a native computer operating system, credit-scoring product, surveillance product, or substitute for licensed financial, legal, medical, or social-work professionals.

## Mission

Help people navigate changing real-life circumstances with more clarity, agency, and practical options—without judging them, taking control, or requiring them to expose their lives.

## Product promise

> Make the next useful step clearer, without taking control away from the person.

## Product principles

1. **User agency first** — the user defines goals, context, priorities, and what to share.
2. **No inferred personal profile** — never infer an individual's income, health, location, employment, family situation, or vulnerabilities from identity, social accounts, or indirect signals.
3. **Voluntary data only** — personal information is entered by the user for a clear purpose, with controls to inspect, correct, export, and delete it.
4. **Useful at every life stage** — do not label users as poor, failing, irresponsible, or at-risk.
5. **Public information, carefully sourced** — public-resource listings show issuer, source, jurisdiction, freshness, and caveats.
6. **Human confirmation for consequential actions** — no application, payment, message, booking, or disclosure without explicit confirmation.
7. **Low-cost by design** — Rp0 is the default; paid APIs, Actors, subscriptions, and infrastructure require explicit approval.
8. **Honest boundaries** — explain uncertainty and hand off high-stakes decisions to qualified services.

## Six product areas

1. Financial Relief — cash-flow visibility, user-controlled scenarios, and next-step planning.
2. Public Support & Resource Navigator — official, current, jurisdiction-aware public resources.
3. Opportunity & Skills Navigator — learning and work opportunities chosen by the user.
4. Family Balance — optional shared planning with explicit invitations and field-scoped permissions; not surveillance.
5. Wellbeing & Capacity — optional self-reflection, not diagnosis or scoring.
6. Future Resilience — user-defined buffers and what-if plans, not prediction.

## Current status

**Stage: working MVP (agentic SaaS, Free tier only).** The repository now contains a functional application in addition to the 36 specification documents. See "Implementation" below for exactly what is built, tested, and deployed. Documents remain specifications; implementation claims are backed by code and test output.

## Implementation

### URLs
- Production (Cloudflare Pages project `sandar`): https://sandar.pages.dev
- Custom domain: https://sandar.biz.id (see Deployment status)
- Health: `/api/v1/health` · Public catalogue API: `/api/v1/catalogue/resources`
- GitHub: https://github.com/Sparkmind-obp-off/Sandar

### Tech stack
Hono (TypeScript) on Cloudflare Pages Functions · Cloudflare D1 (`sandar-production`) · Clerk Production auth (ClerkJS 6.43.1 + Clerk UI 1.42.4; server-side RS256 JWT verification) · vanilla-JS accessible SPA (Bahasa Indonesia) · Vitest.

### Features implemented
| Area | What works | Key paths |
|---|---|---|
| Public experience | Beranda, cara kerja, harga (hypothesis), privasi/ketentuan drafts, aksesibilitas, bantuan; offline banner; skip link; ARIA live announcements | `public/static/core.js` |
| Public catalogue | List/search/filter by topic, kind, status; detail with provenance (publisher, source URL, retrieved/verified dates, review interval, caveats); freshness labels (Terverifikasi / Belum diverifikasi / Informasi lama / Perlu diperiksa); anonymous "report" → needs_review | `GET /api/v1/catalogue/resources[/:id]`, `POST …/:id/report` |
| Guest cash-flow | In-memory calculator, nothing sent to server | `/coba/arus-uang` |
| Auth | Clerk Production sign-in UI; API verifies signature, issuer, expiry, authorized party; one workspace per user | `src/lib/auth.ts` |
| Consent | Purpose-specific: workspace_storage, ai_processing, external_search; grant/revoke; saving blocked without storage consent | `/api/v1/me/consents` |
| Agentic core | Orchestrator + 5 specialist agents, deterministic router, task state machine, clarifying questions, structured layered results, task events audit, cancel/discard | `/api/v1/me/tasks*`, `src/agents/` |
| Plans & progress | Save selected suggestions as plan, add/edit/tick/delete steps, review date, archive/done | `/api/v1/me/plans*` |
| Financial | Cash-flow items CRUD (integer minor units, certainty, recurrence), period summary, scenario preview (never persisted) | `/api/v1/me/cash-flow-items*`, `/cash-flow/summary`, `/scenarios/preview` |
| Goals | CRUD | `/api/v1/me/goals*` |
| Entitlements | Central plan config, server-side quotas (agent runs, AI, search, counts), usage meter | `src/domain/entitlements.ts` |
| Providers (BYOK) | Groq / Tavily / Firecrawl adapters with consent, quotas, daily caps, timeouts, redaction; graceful disabled state | `src/providers/index.ts` |
| Billing | Provider-neutral adapter, mock + Midtrans webhook verification, idempotent webhooks, amount check, state transitions — **OFF in production** | `src/billing/index.ts` |
| Privacy ops | Export (JSON), verified deletion (counts remaining = 0), minimal audit events, rate limits, no-store private responses, CSP/HSTS | `/api/v1/me/export`, `DELETE /api/v1/me/workspace` |
| Curator | Admin-only catalogue create, provider status, Firecrawl extract | `/api/v1/me/admin/*` (Clerk user IDs in `ADMIN_SUBJECTS`) |

### Not yet implemented
Family Balance, wellbeing storage, reminders/notifications, organization tier, live payments/checkout UI, curator UI for editing listings, multi-currency, i18n beyond Indonesian, PWA offline cache.

### Data model
Tables: users, workspaces, goals, cash_flow_items, resource_listings, listing_reports, consent_records, agent_tasks, task_events, plans, plan_steps, usage_counters, provider_usage, rate_limits, subscriptions, payments, webhook_events, audit_events (`migrations/0001_initial_schema.sql`).

### Local development
```bash
npm install
cp .dev.vars.example .dev.vars           # ENVIRONMENT=development enables x-dev-user stub
npm run build
npm run db:migrate:local && npm run db:seed:local
pm2 start ecosystem.config.cjs           # http://localhost:3000
npm test                                 # vitest
npm run typecheck
```

### Environment variables (names only)
Vars (wrangler.jsonc): `ENVIRONMENT`, `APP_ORIGIN`, `AUTHORIZED_PARTIES`, `CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER`, `GROQ_MODEL`, `PROVIDER_DAILY_CAPS`, `BILLING_ENABLED`, `PAYMENT_PROVIDER`.
Secrets (`wrangler pages secret put … --project-name sandar`): `CLERK_SECRET_KEY`, `ADMIN_SUBJECTS`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`, optional `CLERK_JWT_KEY`, `MIDTRANS_SERVER_KEY`.

### Deployment status (verified 2026-11-14)
| Item | State | Evidence |
|---|---|---|
| Cloudflare Pages project | `sandar`, production branch `main` | `wrangler pages deployment list` |
| https://sandar.pages.dev | ✅ live (HTTP 200, `/api/v1/health` → `database: ok`, `environment: production`) | curl smoke tests |
| https://www.sandar.biz.id | ✅ active custom domain, TLS OK | Pages domain status `active` |
| https://sandar.biz.id (apex) | ⏳ pending — Cloudflare reports "CNAME record not set" (currently error 1014) | owner must set DNS (token has no DNS edit permission) |
| D1 `sandar-production` | ✅ migration 0001 applied, 8 catalogue rows (3 samples) | `wrangler d1 migrations apply --remote` |
| Clerk Production | Instance `production`, allowed origins set, FAPI/JWKS live; API rejects anonymous / garbage / forged-signature tokens. Client SDK upgrade committed: ClerkJS 6.43.1 + Clerk UI 1.42.4 (Core 3). | ⏳ production deployment and real human sign-in must be re-verified after the upgrade |
| Secrets | `CLERK_SECRET_KEY`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY` set; `GROQ_API_KEY`, `ADMIN_SUBJECTS` not set | `wrangler pages secret list` (values never printed) |
| Billing | OFF (`BILLING_ENABLED=false`, `PAYMENT_PROVIDER=none`); checkout returns `BILLING_DISABLED` | |
| Sign-in on `*.pages.dev` | Redirects users to `www.sandar.biz.id` (Clerk Production cookies only work on the owner's domain) | |

### Deployment (Cloudflare Pages, owner's account via BYOK token)
```bash
npm run db:migrate:prod                  # applies migrations to remote D1
npm run db:seed:prod                     # idempotent INSERT OR IGNORE
npm run deploy:prod                      # wrangler pages deploy dist --project-name sandar --branch main
```
Rollback: `npx wrangler pages deployment list --project-name sandar`, then redeploy a previous commit (`git checkout <sha> && npm run deploy:prod`) or roll back from the Cloudflare dashboard. D1: export before risky migrations (`npx wrangler d1 export sandar-production --remote --output backup.sql`); D1 Time Travel allows point-in-time restore.

## Documentation index

### Product foundation
- [01 Product vision](docs/01-product-vision.md)
- [02 Principles and non-goals](docs/02-principles-and-non-goals.md)
- [03 Product modules](docs/03-product-modules.md)
- [11 Decision log](docs/11-decision-log.md)
- [13 Open questions](docs/13-open-questions.md)
- [23 Mission and product strategy](docs/23-mission-and-product-strategy.md)

### Experience, onboarding, and journeys
- [04 Core user journeys](docs/04-user-journeys.md)
- [15 Experience and content design](docs/15-experience-and-content-design.md)
- [24 Onboarding and consent](docs/24-onboarding-and-consent.md)
- [25 Customer journey and service blueprint](docs/25-customer-journey-and-service-blueprint.md)
- [26 Information architecture and UI specification](docs/26-information-architecture-and-ui-spec.md)

### Requirements, domain, and calculations
- [14 Product requirements](docs/14-product-requirements.md)
- [16 Financial calculation specification](docs/16-financial-calculation-spec.md)
- [29 Domain rules and requirements traceability](docs/29-domain-rules-and-requirements-traceability.md)

### Data, architecture, AI, and security
- [05 Privacy and safety](docs/05-privacy-safety.md)
- [06 Conceptual data model](docs/06-data-model.md)
- [07 Technical architecture](docs/07-technical-architecture.md)
- [18 AI orchestration and agent boundaries](docs/18-ai-orchestration-and-agent-boundaries.md)
- [19 Initial threat model](docs/19-threat-model.md)
- [27 Database schema and data lifecycle](docs/27-database-schema-and-data-lifecycle.md)
- [28 Backend API and authorization contract](docs/28-backend-api-and-authorization-contract.md)

### Public information and research governance
- [08 Research and source policy](docs/08-research-and-source-policy.md)
- [17 Public catalogue specification](docs/17-public-catalogue-spec.md)
- [30 Research tooling and cost policy](docs/30-research-tooling-and-cost-policy.md)

### Implementation, business, and launch
- [32 Implementation decisions](docs/32-implementation-decisions.md)
- [33 Payment gateway evaluation](docs/33-payment-gateway-evaluation.md)
- [34 Business model and pricing](docs/34-business-model-and-pricing.md)
- [35 Agentic product architecture](docs/35-agentic-product-architecture.md)
- [36 Launch and validation plan](docs/36-launch-and-validation-plan.md)

### Delivery and quality
- [09 MVP roadmap](docs/09-mvp-roadmap.md)
- [10 Domain and deployment plan](docs/10-domain-and-deployment.md)
- [12 Quality and acceptance criteria](docs/12-quality-acceptance.md)
- [20 Implementation backlog](docs/20-implementation-backlog.md)
- [21 Test strategy](docs/21-test-strategy.md)
- [22 Operations and release management](docs/22-operations-and-release.md)
- [31 Product analytics and feedback](docs/31-product-analytics-and-feedback.md)

## Working agreement

- Default language: Bahasa Indonesia, with English technical terms where useful.
- Default operating constraint: Rp0 until the owner explicitly approves a cost.
- Never run a paid scraping Actor, paid API, subscription, or infrastructure upgrade without explicit approval.
- Never scrape personal profiles, private groups, or non-public records for SANDAR.
- Do not publish personal data, secrets, credentials, or real-user case studies.
- Preserve repository history; no force-push.
- Every implementation claim must be supported by an actual repository change or test result.
