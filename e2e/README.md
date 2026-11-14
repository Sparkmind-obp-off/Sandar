# Production E2E checks (Playwright)
Not part of `npm test`. Install separately: `npm i -D playwright && npx playwright install chromium`.
- `resp.mjs <baseUrl>` — horizontal overflow, touch targets, mobile menu at 360–1440 px.
- `signin.mjs` — Clerk SDK version/loaded state on the sign-in page.
- `auth_e2e.mjs` — real Clerk Production session via a short-lived sign-in token, protected API, agent journey, isolation, logout, expiry. Requires `SK` env var = Clerk secret key (never commit it). Creates two temporary users and deletes them at the end.
