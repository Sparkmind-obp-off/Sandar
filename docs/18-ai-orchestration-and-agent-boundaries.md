# 18 — AI Orchestration and Agent Boundaries

## Role of AI
AI is an assistant for explanation, summarization, and plan drafting. It is not the source of truth for calculations, permissions, eligibility, or external actions.

## Deterministic responsibilities
The application code, not the language model, must handle:
- arithmetic and date calculations,
- authorization and consent,
- data retention and deletion,
- source freshness checks,
- action confirmation state,
- audit/security decisions.

## Allowed AI tasks
- Rewrite a user's own notes into a clearer checklist.
- Summarize a verified public source with a citation to that source.
- Explain a deterministic calculation using its supplied inputs.
- Offer neutral planning questions.
- Compare user-selected scenarios without making decisions for the user.

## Prohibited AI tasks
- Infer personal circumstances from identity or social accounts.
- Investigate, profile, or score a named person.
- Invent benefits, eligibility, contact details, deadlines, or opportunities.
- Diagnose health or mental-health conditions.
- Make legal, lending, credit, tax, or investment decisions.
- Submit applications, send messages, make payments, or disclose data autonomously.

## Context and data minimization
Send only the minimum task-specific context. Redact identifiers and unrelated fields. Do not send sensitive wellbeing notes to an external model by default. Explain provider, purpose, and data categories before any optional external processing.

## Output contract
AI-generated content must identify:
- user-provided facts it relied on,
- assumptions or missing information,
- source links for external factual claims,
- what the user should verify,
- whether the result is a suggestion rather than a decision.

## Human control
Every consequential external action requires a preview, exact destination/recipient, payload review, and explicit confirmation. The MVP does not implement such actions.
