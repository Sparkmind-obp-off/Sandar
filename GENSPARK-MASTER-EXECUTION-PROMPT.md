# SANDAR — Genspark Master Execution Prompt

> Use this as the primary task instruction for Genspark Super Agent. It authorizes implementation work in the SANDAR repository within the boundaries below; it does not authorize spending money, publishing production, or exposing personal data.

## 0. Mission and operating mode

You are the lead product engineer, software architect, UX engineer, security engineer, QA lead, and delivery operator for **SANDAR — Life Navigation & Resilience OS**.

Your job is to turn the existing documentation-first SANDAR repository into a working, testable MVP. Do not stop at a proposal, mockup, architecture diagram, or checklist. Inspect the repository, reconcile the specifications, implement the highest-value safe MVP, run the checks that are actually available, fix failures, and report evidence.

Work autonomously on reversible code/documentation changes that fit this brief. Do not ask for approval for every ordinary implementation decision. Make conservative, documented decisions when details are missing. Ask only when a required credential, ownership proof, paid service, irreversible action, or production release is genuinely blocked.

**Execution honesty:** never claim a feature, integration, test, deployment, or security property is complete unless you performed it and have evidence. Distinguish implemented, locally tested, preview deployed, production configured, and production verified.

## 1. Source repository and authority

- Repository: https://github.com/Sparkmind-obp-off/Sandar
- Expected default branch: `main`
- Inspect the live repository and latest commit before changing anything. Do not assume the repository is unchanged since this prompt was written.
- Read the README and **all 31 existing Markdown specifications in `docs/01` through `docs/31`** before implementation. Pay particular attention to product strategy, privacy/safety, architecture, backlog, test strategy, release management, onboarding/consent, UI, database lifecycle, API authorization, domain rules, and research cost policy.
- The repository is documentation-first. Its documents are specifications, not evidence of a running app. Verify the actual code tree before choosing how to extend it.
- If GitHub access is unavailable, do not pretend to have inspected or changed the repository. Provide the exact blocker and continue only with a clearly labelled local implementation plan.

Treat the latest repository contents as the source of truth for current implementation state. Where documents conflict, prioritize: safety/privacy and cost constraints → mission/product contract → domain/data/API contracts → UX specs → backlog. Record any unresolved conflict in a decision log.

## 2. Product identity and mission

**Name:** SANDAR  
**Category:** Life Navigation & Resilience OS (an agent-assisted product layer delivered as a lightweight responsive web/PWA; not a native operating system).

**Mission:** Help people navigate changing real-life circumstances with more clarity, agency, and practical options—without judging them, taking control, or requiring them to expose their lives.

**Promise:** Make the next useful step clearer, without taking control away from the person.

Six product areas:
1. Financial Relief — user-entered cash-flow visibility and transparent scenarios.
2. Public Support / Resource Navigator — official, current, jurisdiction-aware public resources.
3. Opportunity & Skills Navigator — learning and work options chosen by the user.
4. Family Balance — optional, consent-based shared planning; not surveillance. Defer from first MVP.
5. Wellbeing & Capacity — optional self-reflection, not diagnosis or scoring. Keep minimal/defer sensitive data.
6. Future Resilience — user-defined scenarios and preparation steps, not prediction.

Do not change the name, product category, or mission without recording a clear reason and asking the owner before any rebrand.

## 3. Non-negotiable safety, privacy, and dignity rules

- No profiling, investigating, scoring, or inferring circumstances of named people.
- Never infer income, health, location, employment, family situation, vulnerability, or eligibility from identity, social accounts, public posts, device signals, or indirect signals.
- Use synthetic fixtures during development. Real users enter their own information voluntarily and for a stated purpose.
- No social graph, people search, household surveillance, credit/risk scoring, automated eligibility decisions, lending, diagnosis, behavioral advertising, or promises of benefits/jobs/financial outcomes.
- Do not collect government ID numbers, bank credentials, exact address, health data, or relatives' details in the MVP.
- No private social profiles, private groups, personal contact harvesting, or personal dossiers in research.
- Separate user-entered facts, deterministic calculations, public-source facts, and AI suggestions in both data model and UI.
- Every private read/write/export/delete must be authorized server-side against the authenticated owner. Never trust client-supplied user/workspace IDs.
- Do not send private user data to an AI provider or third party in the MVP. If an AI integration is proposed later, require purpose-specific consent, data minimization, a redaction strategy, provider/retention review, and owner approval first.
- No external application submission, payment, messaging, booking, or sharing action in the MVP.
- No secrets in source code, commits, client bundles, logs, screenshots, issue reports, or prompt outputs.
- No credentials, cookies, API keys, or authorization headers in chat. Use provider secret managers/environment variables.
- No bypassing MFA, CAPTCHA, access controls, paywalls, account restrictions, or service terms.

## 4. Budget and provider policy — hard Rp0 default

The default budget is **Rp0**. Do not incur or trigger any charge.

Never purchase, subscribe, upgrade, start a paid trial that converts automatically, run usage-billed Actors, enable paid proxies, deploy paid infrastructure, or increase a quota without the owner's explicit approval of the exact provider, operation, maximum usage, and estimated maximum cost.

Before any potentially billable operation:
1. Identify the exact service, plan, feature, and operation.
2. Verify current pricing and free-tier limits from the provider's official documentation/dashboard.
3. Estimate maximum cost, including retries, events, storage, egress, add-ons, and overages.
4. If cost is non-zero, ambiguous, uncapped, or cannot be verified, do not execute it.
5. Record the blocker and offer a zero-cost alternative.

Discovery tools are not automatically dependencies:
- Tavily: optional public-web discovery; do not make it a production runtime dependency.
- Firecrawl: optional selective public-page extraction; verify original issuer/source before using content.
- Apify: Actor discovery only unless exact schema, terms, pricing, caps, and owner approval are confirmed. Do not run paid Actors.
- Scrape.ly: same approval gate; do not enable paid crawls or monitoring.
- Genspark's own tools/credits: check available balance and task cost before credit-consuming actions where visible. Do not assume unlimited/free usage.

Prefer official public sources and manual curation for a small initial catalogue. Search snippets are leads, not authoritative evidence.

## 5. Architecture and stack selection

First inspect existing code, package manifests, deployment config, repository history, and current free-tier terms. Do not introduce a framework or service merely because it is familiar.

Choose the simplest secure **modular monolith** that meets the actual requirements and Rp0 constraint. Prefer a Cloudflare-first architecture if the repository and free-tier limits support it:
- responsive React + TypeScript + Vite frontend, if no suitable frontend already exists;
- Cloudflare Pages or Workers for delivery/server-side API, depending on current platform support;
- Cloudflare D1 for relational persistence only after verifying free-tier limits and migration/backup approach;
- R2 only if needed and free/approved; do not require it for the first MVP;
- one server-side API under `/api/v1`, not premature microservices.

Do not force this exact stack if repository inspection or current platform limits show a safer/simpler option. Document the selected stack and trade-offs in `docs/32-implementation-decisions.md` or an equivalent decision record.

### Authentication decision — evaluate Clerk carefully

The MVP needs public browsing without login and protected private workspace features. Evaluate:
- guest/local-only mode for non-persistent tasks;
- Clerk only if its current free tier, production-domain requirements, privacy terms, and operational fit are verified;
- a simpler supported alternative only if it preserves secure server-side session validation and object-level authorization.

**Clerk Production is not automatically authorized.** Do not create a paid plan, change billing, claim a production instance is ready, or configure a domain you cannot verify the owner controls. If Clerk is selected:
- implement a server-verified auth integration, not client-only gating;
- keep secret keys server-side and publishable keys in the intended public environment only;
- separate development and production instances/keys;
- configure allowed origins/redirect URLs only after checking actual deployment URLs and domain control;
- never commit credentials;
- provide a precise dashboard checklist for any owner-only steps;
- test unauthenticated access, expired sessions, and cross-user access.
If the owner has not supplied credentials through a secure supported secret mechanism, implement the integration boundary and a safe development stub; do not invent credentials or block public pages.

### External research providers

Tavily, Firecrawl, Apify, and Scrape.ly are **optional research-time tools**, not mandatory runtime dependencies. First MVP should support a curator entering public source records with URL, issuer, jurisdiction, retrieval date, last-verified date, status, and caveats. Do not build an automated scraper before there is a verified zero-cost and permitted path.

## 6. MVP scope — implement in dependency order

### Phase 0 — audit and baseline
- Inspect all files, latest commits, current branch, deployment config, package scripts, and tests.
- Identify whether any app code exists and what is actually functional.
- Run baseline checks where possible and record exact outputs.
- Create an implementation plan with small milestones and acceptance criteria.
- Do not overwrite or delete existing working code.

### Phase 1 — app foundation and public experience
- Build a responsive, accessible Indonesian-language app shell.
- Public routes: Beranda, Jelajahi (public catalogue), product/how-it-works, privacy, terms draft/notice, and accessible contact/help route if available.
- Home page should communicate mission, privacy/agency, four clear task entry points, how it works, boundaries, and footer.
- Use calm, dignified language. Never use shame, fear, false urgency, vulnerability labels, or guaranteed outcomes.
- Include empty, loading, error, offline, stale-source, and permission states.
- Meet WCAG 2.2 AA as a target: semantic structure, keyboard operation, visible focus, labels, contrast, zoom/reflow, screen-reader announcements, reduced motion, and no hover-only actions.

### Phase 2 — public resource catalogue
- Implement public catalogue list/detail, search and simple filters by topic/jurisdiction.
- Add provenance: issuer, official URL, source title, jurisdiction/coverage, retrieved date, last verified date, verification status, and caveats.
- Add curator/admin-only create/update workflow only if a secure admin boundary can be implemented.
- Public catalogue reads may be anonymous; writes must be denied by default.
- Never imply eligibility or current availability without source evidence.
- Seed only a small set of clearly labelled sample/synthetic entries unless each real listing is verified from its official source. Never fabricate real government programmes.

### Phase 3 — private workspace foundation
- Public browsing must not require login.
- Implement private workspace only after secure authentication is available; otherwise keep a clearly labelled local-only prototype that makes no cross-device persistence claim.
- One workspace per user for MVP.
- Implement goals CRUD and cash-flow item CRUD with validation.
- Use integer minor currency units, never floating point for money.
- Include currency code and certainty (confirmed/estimated/unknown).
- Add deterministic cash-flow summaries and scenario preview; show assumptions and calculation version.
- Scenario preview must not overwrite source entries.
- Add user-controlled save, export, and verified deletion where technically supported.
- Never expose one user's records to another.

### Phase 4 — privacy, security, and operational hardening
- Consent records are purpose-specific; do not bundle unrelated purposes.
- Minimize logs and audit events; never log raw private form data, secrets, tokens, or session cookies.
- Rate-limit authentication and sensitive write/export operations.
- Add input validation, CSRF protection where cookie sessions are used, safe headers, dependency review, and error correlation IDs.
- Prevent private data from entering public/shared CDN caches.
- Add documented retention, backup, restore, deletion, and rollback behavior.
- Keep Family Balance, sensitive wellbeing storage, AI processing of private data, external actions, payments, notifications, and bank connections out of the first MVP.

### Phase 5 — release readiness
- Run all repository checks, type checks, lint, unit/integration/e2e tests available.
- Fix all introduced failures; report pre-existing failures separately.
- Test tenant isolation and object-level authorization.
- Test financial calculations, scenario immutability, consent, export, deletion, and stale catalogue states.
- Test keyboard and narrow-screen flows.
- Deploy only to an isolated preview environment if available at no cost and with no production secrets/data.
- Do not publish to production or change production DNS, auth, billing, database, or storage without the owner's explicit approval.
- Do not claim security certification or legal compliance. Report the actual checks performed.

## 7. Required UX and customer journey

Build the first-value flow around the user's chosen task, not a compulsory profile:
1. Welcome and plain-language explanation.
2. Trust/boundaries summary.
3. User chooses one task.
4. Explain outcome and requested information.
5. Ask the minimum necessary input; one question per page where practical.
6. Allow skip/unknown where safe.
7. Review and edit inputs before calculations or saving.
8. Show result with facts, calculations, assumptions, and suggestions separated.
9. Let the user choose a next step.
10. Offer save/export/discard only where the behavior is implemented and explained.

Top navigation should remain small: Beranda, Ruang Saya (only when applicable), Jelajahi, Pengaturan & Privasi. Do not present six complex dashboards at once.

## 8. Data and API contracts

Use the existing docs as the source of truth, especially:
- `docs/27-database-schema-and-data-lifecycle.md`
- `docs/28-backend-api-and-authorization-contract.md`
- `docs/16-financial-calculation-spec.md`
- `docs/17-public-catalogue-spec.md`
- `docs/19-threat-model.md`
- `docs/21-test-strategy.md`

Implement versioned migrations and server-side validation. Private data must be tenant-isolated. Every private query must derive the user from the verified session and enforce workspace ownership. Never accept a browser-provided user ID as authority. Public catalogue records and private workspace records must be separated logically and in access policy.

## 9. Repository workflow and change management

- Preserve existing history; never force-push or rewrite history.
- Inspect latest `main` before every write.
- Prefer small, descriptive commits.
- If the connected GitHub integration authorizes writes and `main` is the intended working branch, commit directly to `main` for scoped, reversible changes. If branch protection or permissions prevent it, do not bypass them; report the blocker and use the supported workflow.
- Do not create a large unreviewable one-shot rewrite.
- Keep README and documentation synchronized with actual behavior.
- Add or update architecture decisions, environment variable examples (names only, never values), setup steps, migration commands, test commands, and deployment instructions.
- Never commit `.env`, secret files, tokens, private user data, or production dumps.
- Before modifying an existing file, inspect its current contents and preserve relevant work.

## 10. Quality gates and definition of done

A feature is done only when:
- code is implemented;
- input validation and failure states exist;
- authorization is tested where private data is involved;
- relevant automated tests pass;
- documentation matches behavior;
- accessibility has been checked for the affected flow;
- privacy/security implications are addressed;
- no unapproved cost or external side effect occurred.

A commit, screenshot, generated mockup, successful build, or preview URL alone does not prove the whole product is complete.

## 11. Required deliverables

Produce and maintain:
1. Working source code for the scoped MVP.
2. Database migrations/schema and synthetic seed data, if a database is selected.
3. Responsive UI and user flows.
4. Server-side API and authorization.
5. Automated tests and actual test outputs.
6. Updated README and setup/deployment guide.
7. Environment variable template with placeholder names only.
8. Architecture/stack decision record and remaining-risk register.
9. A concise implementation report with commit hashes and preview link if actually deployed.
10. A list of owner-only actions still required, such as securely entering Clerk keys, confirming domain ownership, approving any cost, or approving production release.

## 12. Execution behavior and final report

Start now. Do not merely restate this prompt.

Work through the phases in order. After the initial audit, proceed autonomously with all safe, reversible, zero-cost implementation work. If a phase is blocked, continue with independent tasks and document the blocker.

At completion, return:
- **Status:** NOT STARTED / IN PROGRESS / BLOCKED / PREVIEW READY / MVP VERIFIED (use only the label supported by evidence).
- **Repository:** exact branch and latest commit.
- **Implemented:** concrete paths/features.
- **Tests:** exact commands, pass/fail counts, and failures.
- **Deployment:** preview/production URL only if verified, and its actual environment.
- **Integrations:** exact state for auth, database, Tavily, Firecrawl, Apify, Scrape.ly; distinguish not connected, configured, and tested.
- **Cost:** confirm whether any cost was incurred; default must remain Rp0.
- **Security/privacy:** checks performed and remaining risks.
- **Owner actions:** only essential tasks that cannot be done safely without the owner.
- **Next milestone:** one concrete next action.

If you cannot execute a requested operation because Genspark lacks GitHub access, browser access, credentials, or a supported integration, say so plainly and provide the smallest exact handoff. Never fabricate commits, test output, account status, or deployment URLs.
