# 05 — Privacy, Safety, and Trust

## Default stance
Private by default, voluntary by design, minimal by necessity.

## Data rules
- Collect no sensitive data unless a specific user-requested feature cannot function without it.
- Do not ask for national identity numbers, bank credentials, passwords, full card details, or private social-media credentials in the MVP.
- Prefer user-entered totals and ranges over transaction-level feeds.
- Keep personal workspace data separate from public resource catalogue data.
- Never sell personal data or use it for advertising profiles.
- Do not train or fine-tune models on personal workspace data by default.
- Do not send user-entered personal data to external AI or scraping services without clear disclosure and affirmative consent.
- Logs must avoid secrets and unnecessary personal content.

## Consent and permissions
Consent must be specific, informed, revocable, and recorded. Family sharing requires an invitation and explicit acceptance. A user must be able to see what is shared, with whom, and for what purpose.

## AI safety
- Separate user-provided facts from model-generated suggestions.
- Label estimates, assumptions, and unknowns.
- Do not invent public-resource availability, eligibility, contact details, deadlines, or fees.
- Provide source links and last-checked dates for factual directory entries.
- Require human review for consequential outputs.
- Refuse requests to profile or investigate a named non-consenting person.

## High-stakes boundaries
Financial: arithmetic, budgeting support, and general education only; no personalized investment, credit, loan, tax, or legal advice.

Health and wellbeing: optional reflection and planning only; no diagnosis or treatment.

Legal and public benefits: explain published information and direct users to the relevant authority; do not decide rights or eligibility.

Safety and crisis: SANDAR is not an emergency response service. Where a user indicates immediate danger, provide concise direction to local emergency services or trusted human support, based on verified local information.

## Security baseline before real-user data
- Threat model and data-flow map.
- Authentication and authorization review.
- Encryption in transit and at rest where applicable.
- Secure session and recovery flows.
- Rate limiting and abuse controls.
- Secret scanning and dependency review.
- Backup, export, and deletion tests.
- Incident response and breach-notification plan.
- Privacy notice and terms reviewed for the actual operating jurisdiction.

## Release gate
Do not onboard real users with sensitive or consequential data until the storage, consent, deletion, access-control, security, and legal-review requirements above are implemented and tested.
