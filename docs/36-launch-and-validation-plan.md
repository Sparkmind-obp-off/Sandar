# 36 — Launch and Validation Plan

## First-user journey (implemented)
1. Visit `/` → understand promise, boundaries, four task entries (no login).
2. Try `/coba/arus-uang` (in-memory, nothing sent) or browse `/jelajahi`.
3. Sign in (`/masuk`, Clerk Production) only when wanting to save.
4. Grant `workspace_storage` consent explicitly.
5. Write a goal at `/ruang/tugas/baru` → orchestrator routes → optional questions (skippable).
6. Result shows facts / calculations / sources / suggestions separately.
7. Pick steps → save plan → tick progress at `/ruang/rencana/:id`.
8. Export or delete everything at `/pengaturan`.

## Launch gates
| Gate | Status |
|---|---|
| Automated tests (unit + API, tenant isolation, auth, consent, billing mock) | ✅ 45/45 local |
| Production deploy on Cloudflare Pages `sandar` + D1 migrations | see README "Deployment" |
| Clerk Production sign-in completed by a real human in browser | ⏳ owner to perform |
| Manual keyboard + screen-reader pass | ⏳ not yet performed |
| Privacy/terms legal review | ⏳ drafts only |
| Catalogue: at least 10 real entries verified by a curator | ⏳ (currently 0 verified real entries, 5 unverified pointers, 3 samples) |
| Billing | OFF until owner approval (docs/33) |

## Product metrics (aggregate, privacy-preserving; not yet instrumented)
- Activation: % of signed-in users who save a first plan.
- Value: plans with ≥ 1 completed step within 14 days.
- Retention: users returning to review a plan within 30 days.
- Trust: catalogue reports per 100 views; deletion requests.
- Cost: provider calls per active user; quota-exhausted rate.
No third-party analytics or behavioural advertising will be added.

## Pricing tests
Interviews before any checkout. No fake-door buttons; `/harga` states plans are unavailable.

## Next milestone
Owner completes one real sign-in on `https://sandar.biz.id` (or `https://sandar.pages.dev`), then curator verifies the first 10 official catalogue entries.
