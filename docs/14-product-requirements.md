# 14 — Product Requirements (PRD)

## Product outcome
A person can turn a self-described situation into a clearer, user-controlled next step. SANDAR must not decide what a person needs or claim to know their circumstances.

## Primary MVP journey
1. Open SANDAR and understand its limits before entering data.
2. Choose a task: map near-term cash flow or find a public resource.
3. Enter only the minimum information needed; allow skip and estimate labels.
4. Review a transparent summary of facts supplied by the user.
5. See a small set of possible next steps with assumptions and sources.
6. Choose, edit, save, export, or discard the plan.
7. Delete entered data when desired.

## Functional requirements
- FR-01: Core explanatory pages are accessible without an account.
- FR-02: The user can choose one task without completing a profile.
- FR-03: Every personal field has a purpose and can be skipped unless essential.
- FR-04: User facts, calculated values, and generated suggestions are visually distinct.
- FR-05: Calculations are deterministic and reproducible.
- FR-06: Public catalogue results show source, issuer, jurisdiction, freshness, and caveats.
- FR-07: The user can correct inputs and rerun a scenario.
- FR-08: No external action occurs without a separate review and confirmation.
- FR-09: User can export and delete workspace data.
- FR-10: Shared planning is excluded from the first MVP.

## Non-functional requirements
- Bahasa Indonesia first; mobile-first and accessible.
- Fast initial load on constrained connections.
- Privacy by default; no ad trackers.
- Clear empty, loading, stale-data, offline, and error states.
- No dependency on paid APIs for core functionality.

## Success measures
Measure task completion, comprehension of assumptions, perceived clarity, and successful correction/export/deletion. Do not measure or infer vulnerability, wealth, family stability, health status, or employability.

## MVP exclusions
Bank connections, payment execution, lending, investment advice, automated benefits applications, personal risk scoring, family surveillance, diagnosis, and predictive life outcomes.
