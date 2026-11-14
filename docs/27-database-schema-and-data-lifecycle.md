# 27 — Database Schema and Data Lifecycle

## Status
This is an implementation-oriented logical schema, not evidence that a database has been provisioned. Physical SQL, indexes, migrations, and retention settings must be reviewed against the chosen platform before deployment.

## Storage boundaries
Use separate logical stores or strict table namespaces for:
1. **Public catalogue:** publisher-sourced records; no personal workspace content.
2. **Private workspace:** user-owned goals, entries, scenarios, and notes.
3. **Identity/session:** authentication identifiers and session metadata; minimize duplication.
4. **Consent/audit:** purpose records and security events; never copy sensitive form content into logs.

A public listing must never be joined to a user's private profile to infer personal eligibility.

## Core logical tables

### users
- id (opaque primary key)
- auth_subject (unique external auth subject)
- created_at, updated_at
- account_state

Do not store passwords if authentication is delegated to a trusted identity provider.

### workspaces
- id
- owner_user_id
- title (optional user label)
- created_at, updated_at
- deleted_at

MVP: one private workspace per user unless a later requirement justifies multiple workspaces.

### goals
- id, workspace_id
- title, description (optional)
- status, target_date (optional)
- created_at, updated_at, deleted_at

### cash_flow_items
- id, workspace_id
- item_type (income | expense | bill | adjustment)
- label (user-entered)
- amount_minor_units (integer; currency-specific)
- currency_code
- due_or_expected_date (nullable)
- recurrence_rule (nullable; validated format)
- certainty (confirmed | estimated | unknown)
- category (optional user-selected value)
- created_at, updated_at, deleted_at

Never store monetary amounts as floating-point values. Define rounding and currency behavior in the financial calculation specification.

### scenarios
- id, workspace_id
- title
- assumptions_json (validated schema, size-limited)
- source_revision (or calculation version)
- created_at, updated_at, deleted_at

A scenario is a snapshot; it must not silently overwrite source entries.

### resource_listings (public)
- id, title, summary
- publisher_name, publisher_type
- jurisdiction_code, coverage_text
- topic_codes
- official_source_url, source_title
- retrieved_at, last_verified_at
- verification_status (unverified | checked | stale | withdrawn)
- eligibility_text (only quoted/paraphrased from publisher with source)
- cost_text, deadline_at (nullable, source-backed)
- caveats, content_hash
- created_at, updated_at

### opportunity_listings (public)
- id, title, publisher_name, official_source_url
- topic_codes, location_mode
- deadline_at, cost_minor_units (nullable), currency_code
- prerequisite_text, retrieved_at, last_verified_at
- verification_status, caveats

### user_notes
- id, workspace_id, goal_id (nullable)
- body, sensitivity_class
- created_at, updated_at, deleted_at

### consent_records
- id, user_id
- purpose_code, scope_json
- notice_version, granted_at, revoked_at
- consent_status

### audit_events
- id, actor_user_id (nullable for system event)
- workspace_id (nullable)
- event_type, target_type, target_id
- occurred_at, outcome
- request_correlation_id
- minimal metadata only; never store raw personal form payloads, tokens, or secrets.

## Relationship and isolation rules
- Every private row must be reachable through a workspace owned by the authenticated user.
- Every read, update, export, and delete query must enforce workspace ownership server-side.
- Never trust a workspace ID supplied by the browser without checking ownership.
- Shared spaces are not MVP. If added later, use explicit membership rows and field/action permissions; do not grant access by possession of a URL.
- Public catalogue reads can be anonymous; only authorized curators may create/update catalogue records.

## Indexes and constraints
- Unique users.auth_subject.
- Index private tables by workspace_id and updated_at.
- Index public listings by topic, jurisdiction, verification_status, and last_verified_at.
- Foreign keys for workspace-owned records with deliberate deletion behavior.
- CHECK constraints/enums for status and certainty fields.
- Bound text and JSON sizes; validate all JSON against versioned schemas.

## Data lifecycle
- Collect: only after task selection and field explanation.
- Use: only for the stated task/purpose.
- Save: only after the user chooses persistence and understands account storage.
- Export: produce a human-readable, user-owned export.
- Delete: delete workspace records and dependent scenarios/notes; explain any legally/security-required retention of minimal audit data.
- Backup: deletion must propagate to backups under a documented retention window; do not claim instant physical erasure if backups persist.
- Retention: define a schedule before production; do not retain optional wellbeing entries by default.

## Migration discipline
Every schema change needs a versioned migration, rollback or forward-repair plan, synthetic fixture tests, and a check that no migration weakens tenant isolation. Do not run destructive migrations against production without an approved backup and recovery plan.
