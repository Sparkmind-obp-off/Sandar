# 31 — Product Analytics, Feedback, and Learning Loop

## Purpose
Measure whether SANDAR is understandable, useful, safe, and reliable—not whether a user is wealthy, vulnerable, healthy, employable, or “successful”.

## Allowed product signals
Collect the minimum aggregate signals needed to improve the product:
- task started and completed;
- validation error category (not the entered value);
- result viewed;
- user chose to export or save (not the exported content);
- optional “Was this useful?” response;
- accessibility or performance error category;
- source record viewed and stale warning shown.

Prefer aggregate counters and short retention. Do not attach these events to sensitive content or build an individual behavioral profile.

## Prohibited analytics
- ad tracking, cross-site tracking, session replay of private forms;
- recording keystrokes or raw form values;
- individual risk, wealth, wellbeing, family, or employability scores;
- inferred location or demographic segmentation;
- selling, sharing, or monetizing user data;
- analytics on optional wellbeing reflections by default.

## Feedback loop
1. Ask a short, optional usefulness question after task completion.
2. Ask what was unclear, not for a user's full personal story.
3. Separate product feedback from private workspace records.
4. Remove identifying details before analysis.
5. Use synthetic test cases for regression tests.
6. Publish what changed when feedback materially changes a workflow.

## Success measures
- time to first understandable result;
- task completion without support;
- user comprehension of assumptions and source status;
- rate of user corrections successfully applied;
- successful export and deletion;
- accessibility defects and privacy incidents;
- proportion of catalogue entries with current provenance.

Do not optimize completion rate by hiding skip, delete, or exit controls.

## Research ethics
Human research requires informed participation, a clear purpose, minimal collection, a retention statement, and a withdrawal path. Do not identify participants by scraping public accounts or use a person's public posts as consent.
