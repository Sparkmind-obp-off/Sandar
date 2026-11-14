# 20 — Implementation Backlog

Backlog is ordered by dependency and risk. No item is complete until code and tests exist.

## Epic A — Project shell
- A1: Choose stack based on current Rp0 operating limits.
- A2: Create accessible responsive app shell.
- A3: Add environment separation and safe configuration.
- A4: Add CI checks, formatting, linting, and tests.

## Epic B — Private planning foundation
- B1: Define authentication decision (local-only prototype vs account-based).
- B2: Implement workspace ownership and server-side authorization.
- B3: Implement user goal CRUD.
- B4: Implement cash-flow item CRUD with validation.
- B5: Implement deterministic calculation library.
- B6: Implement isolated scenario copies.
- B7: Implement export and verified deletion.

## Epic C — Resource catalogue
- C1: Define catalogue schema and migration.
- C2: Build admin-only source entry and review workflow.
- C3: Build user-facing search/filter by topic and jurisdiction.
- C4: Display source provenance and freshness.
- C5: Add stale/report workflow.

## Epic D — Safety and quality
- D1: Threat model review.
- D2: Consent and privacy UX.
- D3: Access-control, calculation, deletion, and source-freshness tests.
- D4: Accessibility and low-bandwidth review.
- D5: Backup/restore and incident response.

## Explicitly deferred
Family sharing, external AI provider calls, bank connections, payments, automated applications, push notifications, native mobile apps, and paid data providers.

## Definition of done
A backlog item is done only when implementation, tests, documentation, and any required privacy/security review are complete. A commit or generated mockup alone does not prove runtime behavior.
