# SANDAR

**Life Navigation & Resilience OS**

SANDAR is a privacy-first, user-directed system that helps people understand their current situation, organize available resources, navigate opportunities, coordinate voluntarily with people they choose, and prepare for uncertainty.

SANDAR is a **life-navigation system**, not a computer operating system, not a credit-scoring product, not a surveillance product, and not a substitute for licensed financial, legal, medical, or social-work professionals.

## Product promise

> Make the next useful step clearer, without taking control away from the person.

## Product principles

1. **User agency first** — the user defines goals, context, priorities, and what to share.
2. **No inferred personal profile** — never infer an individual's income, health, location, employment, family situation, religion, or vulnerabilities from identity, social accounts, or indirect signals.
3. **Voluntary data only** — personal information is entered by the user for a clear purpose, with controls to inspect, correct, export, and delete it.
4. **Useful at every life stage** — do not label users as poor, failing, irresponsible, or at-risk.
5. **Public information, carefully sourced** — public-resource listings show source, jurisdiction, eligibility caveats, last-checked date, and a route to the official provider.
6. **Human confirmation for consequential actions** — no application, payment, message, booking, or disclosure without explicit confirmation.
7. **Low-cost by design** — the MVP prioritizes open standards, static/PWA delivery, and free public sources; no paid API or actor is assumed.
8. **Honest boundaries** — explain uncertainty and hand off high-stakes decisions to qualified services.

## Six product areas

1. Financial Relief — cash-flow visibility, bill prioritization, scenario planning, and user-chosen next steps.
2. Public Support & Resource Navigator — find public services and assistance using official, current, jurisdiction-aware sources.
3. Opportunity & Skills Navigator — discover learning, work, and income opportunities without scraping private profiles or making promises.
4. Family Balance — voluntary shared planning with explicit invitations and per-person permissions.
5. Wellbeing & Capacity — gentle capacity check-ins and practical planning, not diagnosis or treatment.
6. Future Resilience — buffers, contingencies, goals, and what-if planning.

## Current status

**Stage: documentation-first foundation.** The repository began as an empty documentation-first foundation. It now contains 22 product and engineering documents. This documentation establishes the product boundaries, MVP scope, safety model, data principles, research process, and implementation sequence. It does not claim that a working application, domain, legal clearance, or public-service integration already exists.

## Documentation

- [Product vision](docs/01-product-vision.md)
- [Principles and non-goals](docs/02-principles-and-non-goals.md)
- [Product modules](docs/03-product-modules.md)
- [Core user journeys](docs/04-user-journeys.md)
- [Privacy and safety](docs/05-privacy-safety.md)
- [Conceptual data model](docs/06-data-model.md)
- [Technical architecture](docs/07-technical-architecture.md)
- [Research and source policy](docs/08-research-and-source-policy.md)
- [MVP roadmap](docs/09-mvp-roadmap.md)
- [Domain and deployment plan](docs/10-domain-and-deployment.md)
- [Decision log](docs/11-decision-log.md)
- [Quality and acceptance criteria](docs/12-quality-acceptance.md)
- [Open questions](docs/13-open-questions.md)
- [Product requirements](docs/14-product-requirements.md)
- [Experience and content design](docs/15-experience-and-content-design.md)
- [Financial calculation specification](docs/16-financial-calculation-spec.md)
- [Public catalogue specification](docs/17-public-catalogue-spec.md)
- [AI orchestration and agent boundaries](docs/18-ai-orchestration-and-agent-boundaries.md)
- [Initial threat model](docs/19-threat-model.md)
- [Implementation backlog](docs/20-implementation-backlog.md)
- [Test strategy](docs/21-test-strategy.md)
- [Operations and release management](docs/22-operations-and-release.md)

## Working agreement

- Default language: Bahasa Indonesia, with English technical terms where useful.
- Default operating constraint: Rp0 until the owner explicitly approves a cost.
- Do not run paid scraping Actors, paid APIs, subscriptions, or infrastructure.
- Do not publish personal data, secrets, credentials, or real-user case studies.
- Work on `main` only when the change is ready and the branch head has been checked; preserve existing history and never force-push.
- Every implementation claim must be supported by an actual repository change or test result.
