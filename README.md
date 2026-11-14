# SANDAR

**Life Navigation & Resilience OS**

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

**Stage: documentation-first product and engineering specification.** The repository contains 31 Markdown documents. The latest expansion adds mission/product strategy, onboarding and consent, customer journey/service blueprint, information architecture/UI specification, database and data lifecycle, backend/API authorization contract, domain rules and traceability, research tooling/cost governance, and product analytics/feedback.

These documents are specifications, not evidence of a deployed application. No production database, authentication, API, public-service integration, domain/DNS configuration, or runtime test is claimed by this documentation update.

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
