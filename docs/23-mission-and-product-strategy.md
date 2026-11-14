# 23 — Mission, Product Strategy, and Product Contract

## Mission
Help people navigate changing real-life circumstances with more clarity, agency, and practical options—without judging them, taking control, or requiring them to expose their lives.

## Vision
A trusted, private navigation layer that makes fragmented personal planning and public-resource information easier to understand and act on.

## Product category
SANDAR is a **Life Navigation & Resilience OS**: an agent-assisted product system delivered through a lightweight web/PWA experience. “OS” describes the coordinating product layer, not a native computer or mobile operating system.

## The promise
SANDAR helps a person:
1. Name a goal or question in their own words.
2. Organize only the information needed for that task.
3. Understand facts, calculations, options, assumptions, and uncertainty.
4. Identify a manageable next step.
5. Decide whether to save, share, export, or act.

SANDAR does not promise to solve structural problems or guarantee money, work, benefits, health, legal, or other outcomes.

## Product strategy
- **Entry point:** a user-selected task, not a compulsory profile.
- **Core value:** turn scattered information into a transparent next-step plan.
- **Differentiator:** privacy, dignity, source provenance, deterministic calculations, and user agency.
- **Delivery:** one responsive web application with modular capabilities; no premature microservices.
- **Rollout:** private prototype → usability test with synthetic scenarios → consent-based pilot → release only after privacy/security gates.
- **Economics:** Rp0 operating assumption. No paid API, Actor, infrastructure upgrade, domain add-on, or subscription without explicit approval.

## Primary audiences and jobs-to-be-done
SANDAR serves adults with different circumstances. Do not create personas by guessing a named person's situation. Design around voluntary jobs:
- “Help me understand the next few weeks of money coming in and going out.”
- “Help me find an official service or resource for a topic and location I choose.”
- “Help me compare learning or work opportunities I want to explore.”
- “Help me make a plan that accounts for my time, energy, and responsibilities.”
- “Help me prepare for a possible change without predicting that it will happen.”

## Product pillars
1. Financial Relief — user-entered cash-flow visibility and scenarios.
2. Public Support / Resource Navigator — curated public services and resources.
3. Opportunity & Skills Navigator — learning and work options selected by the user.
4. Family Balance — optional, consent-based shared planning; not surveillance.
5. Wellbeing & Capacity — optional self-reflection, not diagnosis or scoring.
6. Future Resilience — user-defined scenarios and preparation steps, not prediction.

## Product contract
SANDAR must always:
- distinguish user-provided facts, deterministic calculations, public-source facts, and AI-generated suggestions;
- show why a field is requested and allow “skip” unless essential;
- show source, issuer, jurisdiction, checked date, and caveats for public listings;
- let the user correct, undo, export, and delete their own information;
- require explicit, contextual confirmation before any external action or disclosure;
- fail safely when sources, models, authentication, or storage are unavailable.

## North-star outcome
**User-confirmed useful next step:** the proportion of completed sessions in which the user says the session clarified a next step they chose. This is a product-quality measure, not a measure of personal success or vulnerability.

## Guardrail metrics
- sensitive fields requested before task necessity: target 0;
- unapproved external actions: target 0;
- unsupported eligibility or outcome claims: target 0;
- paid operations without approval: target 0;
- cross-workspace data exposure: target 0;
- public listings without provenance: target 0.

## Strategic exclusions
No social graph, public user profile, people search, household surveillance, credit/risk scoring, automated eligibility decisions, lending, payments, diagnosis, job placement promises, or behavioral advertising.
