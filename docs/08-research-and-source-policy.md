# 08 — Research and Source Policy

## Research objective
Build a useful, accurate Indonesian resource and opportunity navigator without scraping private individuals or creating personal profiles.

## Source hierarchy
1. Official Indonesian government portals and agencies.
2. Official local-government portals for jurisdiction-specific services.
3. Public institutions and recognized education providers.
4. Established non-profit or community organizations with clear ownership and update dates.
5. Reputable research organizations for general context, never as a substitute for current local service rules.

## Source record requirements
Every catalogue record must include:
- exact source URL and page title,
- issuing organization,
- geographic coverage,
- service/topic category,
- date retrieved,
- last verified date,
- verification status (unverified, checked, stale, withdrawn),
- eligibility or access details only when explicitly published,
- known caveats and official contact/application route.

## Research workflow
1. Define a user-facing question and jurisdiction.
2. Search official sources first.
3. Open the primary source and confirm details.
4. Capture only fields needed for navigation.
5. Cross-check deadlines, eligibility, fees, and application routes.
6. Record retrieval and verification dates.
7. Review stale or contradictory entries before publication.
8. Provide a direct link so users can confirm current details with the issuer.

## Tool policy
Search and extraction tools are research aids, not proof of authority. Search snippets are leads only. Scrapers must respect site terms, robots rules, access controls, and applicable law. Do not scrape personal profiles, private groups, or non-public records.

Apify, Scrape.ly, Tavily, and Firecrawl may be used for discovery or public-source research only when the specific operation is within the approved Rp0 budget. Actor Store discovery does not mean an Actor was run. Many Actors use pay-per-event pricing; never start one without checking the exact pricing and obtaining explicit approval.

## Initial source leads (not yet ingested as product records)
- OJK — 2026 National Survey on Financial Literacy and Inclusion results: https://ojk.go.id/en/berita-dan-kegiatan/siaran-pers/Pages/Indonesias-Financial-Literacy-and-Inclusion-Indices-Continue-to-Rise-2026-SNLIK-Results-Announcement.aspx
- World Bank Open Data: https://data.worldbank.org/
- OECD Family Database (international context; not Indonesia-specific eligibility information): https://www.oecd.org/en/data/datasets/oecd-family-database.html
- ILO Social Protection platform (check publication date and programme status before use): https://www.social-protection.org/

## Research activity recorded for this foundation
- Firecrawl search returned World Bank Open Data, OECD Family Database, an ILO Indonesia family/children page, and an OJK 2026 literacy/inclusion announcement. Search excerpts only; no programme data was imported into SANDAR.
- Apify Store discovery returned unrelated and paid Actors, including paid lead/trademark/public-data products. No Actor was run.
- Scrape.ly discovery returned public-sector procurement and general web-crawling/search Actors, including pay-per-event pricing. No Actor was run.
- Tavily Research endpoint returned a plan usage-limit error. No research result was relied upon from that request.

## Quality rule
Never state that a resource is currently open, funded, accepting applications, or that a user qualifies unless the official source was checked recently and the claim is explicitly supported.
