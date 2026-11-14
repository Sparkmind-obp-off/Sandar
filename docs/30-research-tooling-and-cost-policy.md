# 30 — Research Tooling, Source Governance, and Cost Policy

## Purpose
Use research tools to discover and verify public information for SANDAR without creating personal dossiers, collecting private data, or introducing unapproved cost.

## Tool roles
- **Tavily:** web discovery and result snippets; use results as leads, not as authoritative proof.
- **Firecrawl:** web search and selective page extraction; verify the issuing organization and source page before publishing a catalogue entry.
- **Apify:** Actor discovery and optional extraction. Store discovery does not mean a run was performed. Inspect the exact Actor schema, pricing model, and limits before any execution.
- **Scrape.ly:** Actor discovery, page extraction, or optional page-change checks. Inspect exact per-result/event pricing and run limits before use.

These tools are research utilities, not SANDAR's production truth layer. No connector or Actor becomes a runtime dependency by being available in ChatGPT.

## Rp0 approval gate
Before running any Actor, crawler, proxy, scheduled monitor, paid API, or usage-billed extraction:
1. Identify the exact provider, Actor, and operation.
2. Read the current pricing model and all event/add-on charges.
3. Estimate maximum items, pages, retries, proxy use, and total possible cost.
4. Confirm whether free-tier use is truly free or merely has a free account.
5. Present the estimate and wait for explicit user approval if any charge is possible.
6. Set a hard item/result/charge cap where supported.
7. Record actual usage and cost after the run.

If pricing is missing, ambiguous, or cannot be capped, do not run it.

## Research policy
- Prefer official Indonesian national and local government sources for public services.
- Prefer official education, training, and institution publishers for opportunities.
- Capture only information needed to help a user navigate to the issuer.
- Never harvest personal contact details, social profiles, family information, or private-group content.
- Respect terms, robots directives, access controls, rate limits, and applicable law.
- Search snippets are discovery evidence only.
- Store original URL, publisher, retrieval time, last verification time, status, and caveats.
- Recheck deadlines, fees, eligibility language, and application route before publication.
- Do not use AI-generated summaries as a substitute for the original source.

## Current discovery notes (2026-11-14)
- Tavily search returned a plan usage-limit error; no Tavily result was relied on.
- Firecrawl returned GOV.UK Design System question-page guidance: ask one question per page where practical and avoid asking users to re-enter information already provided. This is a design reference, not Indonesian law or a requirement to copy GOV.UK verbatim.
- Apify Store default discovery returned social, maps, search, and video Actors. Examples displayed pay-per-event pricing, including TikTok/Instagram results and add-ons. No Actor was run.
- Scrape.ly discovery found a generic website crawler and a website-change monitor. The monitor displayed a pay-per-page-check price (the returned listing showed approximately US$1.80 per 1,000 page checks on the resolved plan). No Actor was run. Pricing can change and must be checked again before use.
- These discovery results do not authorize paid usage and do not create a SANDAR dependency.

## Operational decision
For the MVP, manually curate a small number of official public sources with a documented verification date. Automate ingestion only after a cost-free or explicitly approved route, source permission, validation process, and safe failure mode are established.

## Source references
- GOV.UK Design System — Question pages: https://design-system.service.gov.uk/patterns/question-pages/
- GOV.UK Design System: https://design-system.service.gov.uk/
- OWASP API Security Project: https://owasp.org/www-project-api-security/
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Indonesia Satu Data portal: https://data.go.id/
