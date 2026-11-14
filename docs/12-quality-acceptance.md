# 12 — Quality and Acceptance Criteria

## Product acceptance
- User can choose one module without completing unrelated onboarding.
- User-entered data is distinguishable from generated suggestions.
- Every calculation exposes inputs and formula or explanation.
- Every public factual listing has a source, issuer, jurisdiction, and verification timestamp.
- No feature implies guaranteed eligibility, income, health outcome, or legal result.
- External actions remain disabled until a deliberate review-and-confirm flow exists.

## Privacy acceptance
- No public profile is required for private planning.
- No personal data is sent to an external provider without disclosure and affirmative consent.
- Users can inspect, correct, export, and delete workspace data.
- Shared spaces require explicit invitation acceptance.
- Access control is tested at API and data layer, not only hidden in UI.
- No secrets or personal data appear in logs, public repository files, or analytics.

## Accessibility and usability
- Keyboard navigation and visible focus.
- Clear labels and error messages.
- Responsive layout for mobile and desktop.
- Plain Bahasa Indonesia, explain technical terms.
- Low-bandwidth behavior and graceful offline/connection-loss states.
- No shame-based nudges, urgency dark patterns, or manipulative streaks.

## Engineering acceptance
- Automated tests for calculations, permissions, consent, and deletion.
- Dependency and secret scans before pilot.
- Preview environment isolated from production data.
- Backup restoration tested.
- Error handling for unavailable external sources.
- Versioned source catalogue and rollback procedure.

## Release levels
- **Documentation-ready:** this repository's product and safety foundation exists.
- **Prototype-ready:** synthetic-data application flows work.
- **Pilot-ready:** privacy, security, support, and operational gates pass.
- **Public-launch-ready:** legal, operational, reliability, and accessibility reviews are complete.

Never describe one level as another.
