# 29 — Domain Rules and Requirements Traceability

## Domain rules
1. A user-selected goal is the source of task intent; SANDAR must not invent one.
2. A missing value is unknown, not zero.
3. An estimate must remain visibly an estimate through calculations and summaries.
4. A calculation must be reproducible from versioned inputs and rules.
5. A scenario is a separate snapshot and cannot silently mutate the original plan.
6. A public listing is not an official decision about the user.
7. “Checked” means the cited publisher page was inspected on the recorded date; it does not guarantee future accuracy.
8. A stale or withdrawn listing cannot be represented as currently available.
9. An AI suggestion is not a fact, calculation, or official instruction.
10. Sensitive optional reflections are excluded from cross-module use and analytics by default.
11. Consent is purpose-specific, revocable, and recorded.
12. External action is disabled unless a future release has a separate approval design and explicit confirmation.

## Requirement traceability

| Requirement | Design source | Implementation evidence required |
|---|---|---|
| Task-first entry | 23, 24, 26 | Visitor can start one task without profile |
| Optional minimum inputs | 24, 26 | Form tests prove skip/unknown handling |
| Transparent calculations | 16, 29 | Deterministic unit tests and displayed assumptions |
| Provenance and freshness | 17, 25, 27 | Catalogue schema and UI show issuer/source/dates |
| Private workspace isolation | 19, 27, 28 | Cross-user authorization tests pass |
| Export and deletion | 27, 28 | End-to-end lifecycle tests and retention notice |
| No unapproved AI disclosure | 18, 24, 28 | Consent and request-payload tests |
| Accessible interaction | 15, 26 | Keyboard, screen-reader, contrast, reflow tests |
| Rp0 default | 22, 30 | Dependency and usage-cost review recorded |
| Safe failure | 25, 28 | Offline, stale, save, delete, and upstream tests |

## Definition of ready
A feature is ready for implementation only when it has:
- user problem and intended outcome;
- entry condition and exit condition;
- required and optional fields;
- domain rules and failure states;
- data classification and retention behavior;
- authorization rules;
- acceptance tests;
- cost and dependency review.

## Definition of done
A feature is done only when:
- code is implemented and reviewed;
- migrations and authorization checks exist where needed;
- unit, integration, and end-to-end tests pass;
- accessibility and privacy checks are completed;
- UI states are implemented;
- source claims are verified;
- release notes and rollback/recovery notes are recorded.

A Markdown specification alone is not implementation evidence.
