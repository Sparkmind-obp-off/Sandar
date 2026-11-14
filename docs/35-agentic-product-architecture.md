# 35 — Agentic Product Architecture

## Overview
```
Browser (Ruang Saya) ──Bearer JWT──▶ /api/v1/me/tasks
                                      │
                              SANDAR Core (orchestrator.ts)
                 route ▶ plan ▶ (ask) ▶ run bounded tools ▶ consolidate ▶ store
                                      │
     ┌──────────────┬──────────────┬──┴───────────┬────────────────┬───────────────┐
 Life Navigation  Financial Nav  Public Resource  Opportunity&Skills  Resilience
     │                │               │                 │                 │
 deterministic    cashflow calc    catalogue_lookup  catalogue_lookup   deterministic
 planner          (finance.ts)     tavily (opt)      tavily (opt)       planner
     └──────── groq_rewrite (optional, consent + quota + redaction) ────────┘
                                      │
                         Plan & Progress (plans, plan_steps)
```

## Routing
`routeObjective()` — explicit area wins; else Indonesian keyword match; else Life Navigation. Deterministic and testable; no model call needed to route.

## Agent contracts (`src/agents/registry.ts`)
Each agent defines: id, area, purpose, allowed tools, prohibited actions, timeout (20 s), and ≤ 2 optional clarifying questions (choice or short text). Common prohibitions: no submissions/payments/messages, no eligibility-as-fact, no profiling of named people, no medical/legal/tax/investment/credit advice, no outcome promises. Financial agent additionally never suggests borrowing, investing, selling assets or skipping payments.

## Task state machine
`queued → planning → (awaiting_user_input →) running → completed | failed`, plus `cancelled` from any non-terminal state; `awaiting_approval` reserved for future external actions (none in MVP). Transitions enforced by `canTransition()` and an `UPDATE … WHERE status = from` guard (no double runs). Completed tasks cannot be rerun (409).

## Output schema (`AgentResult`)
`user_facts`, `calculations`, `sources` (with URL, last-checked date, freshness label), `web_leads` (explicitly unverified), `options`, `next_steps`, `assumptions`, `uncertainties`, `ai {used, provider, model, reason_not_used}`, `search {used, reason_not_used}`, `disclaimer`. Every item has a `kind`: `user_fact | calculation | source_fact | suggestion | ai_suggestion`, rendered with distinct labels.

## Tools and guards
| Tool | Data sent externally | Guards |
|---|---|---|
| cashflow_calculator | none | workspace-scoped query |
| catalogue_lookup | none | read-only, excludes withdrawn |
| tavily_search | redacted objective only | consent `external_search`, monthly quota, global daily cap, 12 s timeout |
| groq_rewrite | redacted objective + area name only (no finances) | consent `ai_processing`, monthly quota, global daily cap, 15 s timeout, system prompt with prohibitions, output labelled "Saran AI" |
| firecrawl_scrape | a public https URL chosen by curator | admin-only, URL validation, daily cap |

## Observability / audit
`task_events` records status changes and each tool call (tool, outcome code, latency). `audit_events` records identifiers and outcomes only — tested to never contain objective text.

## Fallback behaviour
If AI/search is unconfigured, unconsented, over quota, capped, timed out or erroring, the task still completes with deterministic options and steps and states the reason (`reason_not_used`). Tested.

## Human control
Users choose which suggestions become plan steps, edit/delete steps, set review dates, discard results (deletes the task) and cancel pending tasks.
