# SANDAR — UX Refresh & Customer Journey

**Date:** 2026-11-15  
**Status:** Implemented in frontend source; production deployment and device QA pending.

## 1. Source review

Reviewed the supplied mobile-browser screenshot from `Dff-mdia-sndrr-1` and the current SANDAR frontend source:
- `src/index.ts`
- `public/static/core.js`
- `public/static/styles.css`
- `public/static/ruang.js`
- `public/static/app.js`

The screenshot showed a clear, calm visual foundation and consistent SANDAR identity. It also showed a desktop-like navigation wrapping into multiple lines on a phone, a three-column task grid with compressed cards, and a homepage that explained the product but did not strongly guide first-time users through a next action.

## 2. UX direction

Preserve the existing visual identity:
- Deep green as the primary action colour.
- Warm neutral page background and white content surfaces.
- Plain Indonesian language, respectful and non-stigmatizing.
- Clear privacy, consent, and user-control messages.

Improve hierarchy and progression rather than replacing the brand with a generic SaaS dashboard.

## 3. Homepage changes

The homepage is reorganized around:
1. A clearer value proposition and two primary actions: start a guided journey or explore without an account.
2. Four user-need entry points: cash-flow understanding, public resources, opportunities/skills, and resilience planning.
3. A four-stage explanation: tell us, map options, decide, review.
4. A compact trust/privacy section explaining user control and boundaries.

The copy avoids implying that SANDAR can decide eligibility, guarantee outcomes, or act on behalf of a user.

## 4. Guided onboarding

Added public route `/mulai`:
- Step 1 of 3: select one starting area.
- Five starting areas: life navigation, finance, public resources, opportunity/skills, resilience.
- The selected area is carried to the task form using a URL query parameter.
- Account sign-in is requested only when continuing into the private workspace to create/save a task.
- Public catalogue browsing remains available without an account.
- Onboarding warns users not to submit identity numbers, passwords, bank account numbers, or sensitive data.
- Storage and AI/search consent remain separate and are not preselected by onboarding.

This is a guided entry step, not a claim that a full multi-step accountless task composer has been implemented.

## 5. Responsive UI changes

- Tablet layout: feature cards and process steps use two columns.
- Narrow mobile layout: cards and steps stack into one column.
- Mobile main navigation becomes a horizontally scrollable row rather than wrapping into a second large row.
- Hero typography and actions adapt to narrow screens.
- Onboarding choices have visible selected states and full-width mobile actions.
- Focus styles, semantic headings, labels, and reduced-motion support remain in place.

## 6. Customer journey

| Stage | User experience | Access |
|---|---|---|
| Discover | Understand SANDAR's purpose and privacy boundaries | Public |
| Choose | Select a starting area at `/mulai` | Public |
| Explore | Browse public sources and basic tools | Public |
| Authenticate | Sign in/sign up before private workspace actions | Clerk |
| Describe | Write one objective and optionally choose specialist area | Private workspace |
| Consent | Separately opt into storage, AI processing, or external search as required | User-controlled |
| Orchestrate | SANDAR Core routes to scoped capabilities and produces a structured result | Backend |
| Review | User accepts, edits, or rejects suggestions | Private workspace |
| Plan | Save selected next steps and milestones | Storage consent |
| Return | Review progress and revise plans | Private workspace |

## 7. Files changed

- `public/static/core.js`: homepage refresh and new `/mulai` onboarding route.
- `public/static/styles.css`: responsive navigation, homepage hierarchy, cards, journey flow, onboarding states.
- `src/index.ts`: cache-busting versions for frontend assets.

## 8. Acceptance checks still required

Do not mark this UX release complete until:
- [ ] Cloudflare Pages production deployment has completed.
- [ ] Test at widths 360px, 390px, 430px, 768px, 1024px, and desktop.
- [ ] Check navigation keyboard access, focus visibility, screen-reader announcements, and 200% zoom.
- [ ] Confirm `/mulai?area=finance` preserves the chosen area through sign-in redirect and opens the correct task form.
- [ ] Confirm users can still explore public sources without signing in.
- [ ] Confirm no consent checkbox is preselected and no data is persisted by onboarding alone.
- [ ] Run project checks and real-device smoke tests.
- [ ] Re-test sign-in after the Clerk SDK upgrade independently of this UX work.

**Important:** Source changes committed to GitHub do not prove production deployment. Keep production status pending until the deployed asset versions and live customer journey are checked.
