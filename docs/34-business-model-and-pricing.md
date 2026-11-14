# 34 — Business Model and Pricing

**Model:** Freemium Agentic SaaS + future Organization tier. Software is the product; no hidden human operations.

## Principles
- Free tier is genuinely useful: public catalogue, deterministic cash-flow + scenarios, plans/progress, export/delete — always free.
- Paid tiers sell capacity, depth, and history — never access to essential safety information or public resources.
- No unlimited AI. When quotas are exhausted, non-AI features keep working (tested: `agent run quota is enforced server-side`).
- No background AI or search calls; every provider call is user-triggered.

## Pricing hypothesis (version `2026-11-14.hypothesis-1`, single source: `src/domain/entitlements.ts`)
| Plan | Price | Agent tasks/mo | AI assists/mo | Web searches/mo | Active plans | Goals | Cash items | History |
|---|---|---|---|---|---|---|---|---|
| Gratis | Rp0 | 30 | 10 | 5 | 3 | 10 | 60 | 90 d |
| Plus Bulanan | Rp29.000/bln | 300 | 150 | 60 | 20 | 100 | 500 | 730 d |
| Plus Tahunan | Rp290.000/thn (save Rp58.000 ≈ 2 months) | same as Plus | | | | | | |
| Organisasi | Contact (not offered yet) | — | — | — | — | — | — | — |

All amounts are hypotheses for validation, displayed as such in UI (`/harga`) and API (`/api/v1/pricing`, `hypothesis: true`).

## Entitlement mechanics (implemented)
- `users.plan_id` defaults to `free`; only a verified `paid` webhook upgrades it; `refunded` reverts to free.
- `usage_counters(user_id, metric, period)` with atomic conditional increment (`consume()`), so limits cannot be exceeded by concurrent requests.
- Count-based limits (goals, cash items, active plans) checked on create, return `402 QUOTA_EXCEEDED` with a plain-language message.
- `subscriptions` table: status pending/active/grace/cancelled/expired, `current_period_end`, `cancel_at_period_end`. Cancellation endpoint sets cancel-at-period-end.

## Unit-economics assumptions (to validate)
- Groq: model `llama-3.1-8b-instant`, ≤ 450 output tokens per assist. Groq has a free tier with rate limits; paid pricing is per token — **verify current rates on console.groq.com before enabling a paid key**. At published low per-million-token prices, 150 assists × ~1k tokens is expected to cost well under Rp1.000/user/month, but this must be measured.
- Tavily: free plan with a monthly credit allowance (verify); 60 searches/mo for Plus may exceed free allowance at scale → needs paid plan or lower quota.
- Cloudflare: Pages + D1 free tier sufficient for early users.
- Payment fees: see docs/33 (≈0.7% QRIS at Midtrans/Duitku).
- Taxes: PPN on SaaS sold in Indonesia and income tax obligations — owner to confirm with tax adviser.

## Validation plan
1. Free-tier usage telemetry (aggregate counters only) for 4–6 weeks.
2. Willingness-to-pay interviews (≥ 15 users across income levels) — no dark patterns.
3. Fake-door is **not** used; the UI honestly says paid plans are not available yet.
4. Decide price & quotas from measured provider costs; then enable billing in sandbox → production with explicit owner approval.
