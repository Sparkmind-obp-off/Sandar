# 25 — Customer Journey and Service Blueprint

## Journey map

| Stage | User question | Frontstage experience | System responsibility | Exit condition |
|---|---|---|---|---|
| Discover | What is SANDAR? | Plain-language landing page, boundaries, privacy summary | Serve public content; no tracking profile | User understands purpose |
| Orient | Can this help with my task? | Task cards and examples | Route to a specific workflow | User selects a task |
| Prepare | What do I need to enter? | Short explanation and optional inputs | Validate only task-required fields | User reviews inputs |
| Work | What does this information mean? | Calculation, catalogue, or structured plan | Deterministic rules; sourced data; AI only where permitted | Result is understandable |
| Decide | What can I do next? | Options, trade-offs, links, checklist | Explain provenance and uncertainty | User chooses or dismisses |
| Keep | Can I return to this? | Save, export, or discard choice | Auth, workspace isolation, lifecycle controls | User confirms storage choice |
| Return | What changed since last time? | User-initiated review | Show only saved task data and verified source changes | User updates or closes task |
| Leave | Can I take my data away? | Export/delete controls | Verify ownership; execute lifecycle operation | Completion and limits shown |

## Supported MVP journeys

### A. Cash-flow clarity
1. User chooses a planning period.
2. User enters known income and expenses, with dates and certainty labels.
3. System validates formats and identifies missing/uncertain values.
4. Deterministic calculation displays totals and time sequence.
5. User reviews assumptions and can correct or remove any item.
6. User compares a small number of user-defined scenarios.
7. User chooses whether to save or export.

The system must not rank a person's worth, predict default, or automatically choose which bill to pay.

### B. Public-resource discovery
1. User selects a topic and optional jurisdiction.
2. Search returns curated public records.
3. Each record displays issuer, location coverage, source URL, last checked date, and status.
4. User opens the official publisher's page.
5. User decides independently whether to contact or apply.

No eligibility determination or application submission in the MVP.

### C. Opportunity exploration
1. User selects a learning/work topic or enters a skill they want to develop.
2. System presents verified public opportunities with deadline, cost, mode, and prerequisites only when sourced.
3. User compares options and creates a preparation checklist.
4. User follows the publisher's official route.

No automated application, recruiter contact, or promise of employment.

### D. Optional wellbeing/capacity reflection
1. User explicitly opens the module.
2. User chooses a self-described check-in prompt.
3. System stores nothing unless the user chooses to save.
4. Any generated reflection is clearly non-clinical.
5. User can delete the entry immediately.

Do not use this data for analytics, ranking, or other modules by default.

## Service recovery journeys
- **No result:** explain that no verified listing was found; offer a broader topic or official source directory.
- **Stale listing:** label it stale, suppress claims that depend on current status, and show the publisher link.
- **Source unavailable:** retain the last verified snapshot with its date and an unavailable warning; do not claim it is current.
- **AI unavailable:** keep deterministic calculations and user-entered notes usable.
- **Save failure:** preserve the user's current input where safe, explain that it was not saved, and provide a copy/export fallback if implemented.
- **Delete failure:** do not claim deletion succeeded; show status and a safe retry/support path.
- **Authentication expiry:** explain that the session expired and avoid losing unsaved work where technically possible.

## Journey invariants
- User chooses the goal and task.
- No forced profile, hidden inference, or third-party enrichment.
- No external side effect without a separate review and exact confirmation.
- User can go back, edit, pause, or exit.
- Every factual public listing is traceable to a source.
- The product never disguises uncertainty as certainty.

## Research and validation
Test journeys with synthetic scenarios first. For any human usability study, recruit consenting participants, explain what is recorded, minimize collection, and allow withdrawal. Do not recruit by scraping or profiling individuals.
