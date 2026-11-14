# 07 — Technical Architecture

## Architecture stance
Start as a lightweight web application/PWA with a modular monolith. Do not split into microservices until real load, team, or isolation requirements justify it.

## Logical layers
1. **Experience layer:** responsive web/PWA; accessible, low-bandwidth, Bahasa Indonesia first.
2. **Application layer:** module workflows, validation, user permissions, and orchestration.
3. **Domain layer:** goals, cash-flow calculations, resource listings, opportunities, consent, and scenarios.
4. **Data layer:** private workspace storage separated from public catalogue storage.
5. **Source layer:** curated official public sources with provenance and refresh status.
6. **AI assistance layer:** optional summarization and planning support behind explicit data-sharing controls.

## MVP technical direction
A static-first frontend and small server-side API are preferred. Choose the simplest stack that can enforce authorization and deletion correctly. Cloudflare Pages/Workers/D1/R2 may be evaluated if cost and operational limits are confirmed; this is a candidate architecture, not a claim of deployed infrastructure.

## AI design
- Deterministic code for calculations, dates, totals, and permission checks.
- AI for drafting explanations, summarizing verified source material, and helping users articulate plans.
- Retrieval from a curated, versioned source catalogue.
- No model-generated factual claims without a source or an explicit uncertainty label.
- Redact personal fields before any external AI call unless the user has knowingly opted in.

## Integration policy
No integration is enabled merely because a connector or API exists. Every integration requires:
- a user-visible purpose,
- documented data sent and received,
- cost and rate-limit review,
- privacy and security review,
- a fallback when unavailable,
- explicit owner approval for paid services.

## Reliability
- Graceful degradation when external sources are unavailable.
- Cache public catalogue content with a visible last-verified timestamp.
- Do not cache sensitive user data in shared/public caches.
- Maintain backups and tested restoration procedures before production use.

## Deployment environments
- Local/development: synthetic data only.
- Preview: isolated from production data and secrets.
- Production: enabled only after security, privacy, and operational release gates pass.
