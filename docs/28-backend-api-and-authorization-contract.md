# 28 — Backend API and Authorization Contract

## Status
Logical API contract for implementation planning. These routes are proposed; they are not deployed endpoints.

## Architecture
Use a modular monolith with a small server-side API. The browser must not connect directly to private database credentials or privileged catalogue-write credentials. Domain calculations and permission checks remain server-side or in a tested deterministic shared library.

## API conventions
- Version routes under `/api/v1`.
- JSON request/response; UTF-8.
- Opaque IDs; never expose sequential identifiers as authorization.
- Validate request bodies, types, lengths, enum values, dates, and numeric bounds.
- Return consistent errors with a safe message and correlation ID.
- Apply rate limits to authentication, writes, exports, and expensive operations.
- Use idempotency keys for retryable create operations where duplicate creation is harmful.
- Never log authorization headers, cookies, secrets, or raw sensitive request bodies.

## Proposed route groups

### Public and catalogue
- `GET /api/v1/catalogue/resources?topic=&jurisdiction=`
- `GET /api/v1/catalogue/resources/:id`
- `GET /api/v1/catalogue/opportunities?topic=&mode=`
Public responses include publisher, official source URL, coverage, status, retrieved/verified dates, and caveats.

### Private workspace
- `GET /api/v1/me/workspace`
- `GET /api/v1/me/goals`
- `POST /api/v1/me/goals`
- `PATCH /api/v1/me/goals/:id`
- `DELETE /api/v1/me/goals/:id`
- `GET /api/v1/me/cash-flow-items?from=&to=`
- `POST /api/v1/me/cash-flow-items`
- `PATCH /api/v1/me/cash-flow-items/:id`
- `DELETE /api/v1/me/cash-flow-items/:id`
- `POST /api/v1/me/scenarios/preview`
- `POST /api/v1/me/export`
- `DELETE /api/v1/me/workspace`

### Consent
- `GET /api/v1/me/consents`
- `POST /api/v1/me/consents`
- `POST /api/v1/me/consents/:id/revoke`

## Authentication and authorization
- Public catalogue GET routes may be anonymous.
- Every private route requires a valid authenticated subject.
- Resolve the user from the verified session/token on the server; never accept user_id as proof of identity.
- Resolve workspace ownership from the authenticated user, not a client-supplied owner field.
- Check authorization on every object read and write (object-level authorization).
- Deny by default. Return 404 or 403 consistently according to the chosen information-disclosure policy.
- Admin catalogue operations require a separate privileged role and audit trail; do not reuse ordinary user permissions.

## Validation and business rules
- Monetary values use integer minor units and a declared currency.
- Dates and recurrence values are normalized and validated.
- Scenario preview must not persist or overwrite source records.
- Public listing data must carry provenance and verification status.
- A stale listing cannot be returned as “verified current”.
- AI output is untrusted draft content; validate and label it before display.
- No API may submit a government application, send a message, make a payment, or share private data in the MVP.

## Error contract
Use stable machine-readable codes, for example:
- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RATE_LIMITED`
- `SOURCE_STALE`
- `UPSTREAM_UNAVAILABLE`
- `SAVE_FAILED`
- `EXPORT_FAILED`
- `DELETE_PENDING`

Do not return stack traces, SQL, secrets, internal prompts, or private record values in errors.

## Security tests
- User A cannot read, update, export, or delete User B's records by changing IDs.
- Missing/expired session cannot access private routes.
- Catalogue write endpoints reject ordinary users.
- Malformed/oversized JSON is rejected.
- Rate limits and CSRF protections are tested where cookie-based sessions are used.
- Repeated create requests do not create unintended duplicates.
- Deletion and export are tested across all dependent entities.
- No private data enters public caches or shared CDN cache keys.
