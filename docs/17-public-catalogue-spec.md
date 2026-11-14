# 17 — Public Catalogue Data Specification

## Purpose
Define the minimum record needed to publish public support, service, learning, and opportunity listings responsibly.

## Required fields
- id
- title
- summary (neutral, factual)
- category
- publisher / issuing organization
- jurisdiction and coverage
- canonical source URL
- retrieved_at
- last_verified_at
- verification_status: unverified | checked | stale | withdrawn
- record_owner / reviewer
- caveats
- updated_at

## Conditional fields
Eligibility, required documents, fees, deadline, opening status, application route, contact details, and service hours may be populated only when explicitly supported by a current primary source. Otherwise omit them or mark “not confirmed”.

## Publication gates
A record cannot be shown as verified unless:
- the primary source was opened,
- the publisher and jurisdiction are clear,
- key claims are supported by the page,
- dates and application route were checked,
- the source is not obviously expired or superseded.

## Freshness policy
Each category must have a defined review interval before publication. If the review interval passes, mark the listing stale and remove “currently available” language. Urgent deadlines require a fresh check close to display time.

## Provenance
Keep a source snapshot or minimal evidence note sufficient for reviewers to reproduce the check, subject to source terms. Do not copy large copyrighted page sections. Prefer concise summaries and direct links.

## User reports
A report changes review status to “needs review”; it does not automatically prove a listing is false. Keep moderation decisions and timestamps.

## Prohibited data
No private account data, personal social profiles, sensitive individual records, or inferred eligibility labels.
