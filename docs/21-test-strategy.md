# 21 — Test Strategy

## Test layers
- Unit: calculations, recurrence, date handling, validation, formatting.
- Integration: repository/data access, workspace isolation, consent checks, deletion.
- End-to-end: first task journey, scenario edit, resource lookup, export/delete.
- Security: cross-workspace access, privilege escalation, injection, session behavior, secret scanning.
- Accessibility: keyboard-only, screen-reader labels, focus order, contrast, zoom.
- Resilience: offline state, unavailable catalogue source, timeout, backup restore.

## Required fixtures
Use synthetic people, amounts, locations, and resource listings. Never place a real user's personal situation or credentials in fixtures.

## Critical invariants
1. A user cannot read or modify another workspace.
2. An unaccepted invitation grants no access.
3. Scenario edits do not mutate baseline records.
4. Deletion removes user content from active storage and documents any legally/operationally necessary retention.
5. An unverified or stale listing is never presented as confirmed currently available.
6. AI output cannot bypass application authorization or confirmation.
7. Calculations are reproducible from the displayed inputs.

## Release evidence
Record command, environment, date, pass/fail count, and commit SHA. Do not claim tests passed unless they were actually executed in that environment.
