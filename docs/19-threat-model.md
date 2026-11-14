# 19 — Initial Threat Model

This is a planning baseline, not a completed security audit.

## Assets
- Private workspace records.
- Optional sensitive reflections.
- Authentication/session material.
- Consent and sharing permissions.
- Public catalogue integrity.
- Deployment secrets and backups.

## Threat actors and failure modes
- Unauthorized user accesses another workspace.
- Shared-space member sees fields outside granted scope.
- Malicious or compromised dependency exfiltrates data.
- Prompt injection in a public source manipulates an AI summary.
- Stale or fraudulent listing misleads a user.
- Logs, analytics, exports, or backups expose personal data.
- Account takeover through weak recovery or session handling.
- Accidental publication of secrets or private case studies in Git.

## Minimum mitigations
- Server-side authorization on every object read/write.
- Deny-by-default permissions and explicit sharing.
- Strict input validation and output encoding.
- Secrets only in provider secret stores; secret scanning in CI.
- Treat retrieved webpages and files as untrusted data, never as instructions.
- AI retrieval limited to curated sources; quote/source attribution and human review.
- Separate public catalogue from private workspace storage.
- Avoid sensitive content in logs and analytics.
- Rate limiting, secure session lifecycle, and tested account recovery.
- Encrypted backups with access restriction and restore tests.
- Dependency review and vulnerability scanning before pilot.

## Abuse and privacy controls
- No bulk export of other users' data.
- No public user directory.
- No personal vulnerability score.
- No hidden monitoring or third-party ad pixels.
- Clear report and deletion routes.

## Release gate
Before a pilot, document data flows, conduct an access-control test, verify export/deletion, review dependencies and secrets, test backup restoration, and complete incident-response ownership.
