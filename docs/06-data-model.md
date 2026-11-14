# 06 — Conceptual Data Model

This is a conceptual model, not a deployed schema.

## Entities
- **Workspace:** private container owned by one user; contains settings and user-created records.
- **UserGoal:** a user-defined outcome, priority, or review target.
- **CashFlowItem:** user-entered income, expense, bill, or planned amount with date, recurrence, confidence, and optional category.
- **Scenario:** a copy of selected values with explicit assumptions; never overwrites source data without confirmation.
- **ResourceListing:** public catalogue entry with issuer, jurisdiction, source URL, service topic, source date, last-checked date, status, and caveats.
- **OpportunityListing:** public learning/work opportunity with publisher, location/remote mode, deadline, cost, prerequisites, source URL, and verification state.
- **SkillNote:** skills or interests voluntarily entered by the user.
- **CapacityCheckIn:** optional user-defined reflection; highly private and excluded from analytics by default.
- **SharedSpace:** explicitly created space for a defined purpose.
- **Invitation:** pending/accepted/declined/revoked invitation with permissions.
- **ConsentRecord:** purpose, scope, version, timestamp, and revocation state.
- **AuditEvent:** security-relevant event with minimal metadata; avoid storing sensitive content.

## Data classification
1. Public reference data — source-backed catalogue records.
2. Personal workspace data — goals, cash-flow items, notes, scenarios.
3. Sensitive optional data — wellbeing reflections or other sensitive context voluntarily entered.
4. Security metadata — authentication and audit events.

## Required metadata
For user-owned records: owner, created_at, updated_at, and deletion state. For public listings: source URL, issuing body, jurisdiction, retrieved_at, last_verified_at, status, and reviewer where applicable.

## Design constraints
- Use opaque identifiers; do not encode identity or sensitive attributes in IDs.
- Enforce workspace-level authorization on every read and write.
- Shared access must be explicit and field-scoped.
- Never use personal workspace records as public catalogue content.
- Do not create a cross-user profile or global vulnerability score.
- Export should be human-readable and deletion should cascade or clearly explain retained security records.

## Analytics
MVP analytics should be privacy-preserving and aggregate only what is necessary to improve usability. No behavioral advertising, individual risk scoring, or cross-site tracking.
