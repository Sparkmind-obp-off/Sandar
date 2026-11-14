# 24 — Onboarding, Consent, and First-Value Flow

## Objective
Let a visitor understand SANDAR and reach one useful task quickly, without forcing registration, sensitive disclosure, or a full life-history questionnaire.

## Entry states
- **Visitor:** can read product explanations and explore public catalogue content.
- **Guest task:** can complete a supported task with temporary/in-memory or local-only state, if the implementation can explain the storage behavior accurately.
- **Authenticated workspace owner:** can save private records after seeing what account storage means.
- **Invited participant:** exists only after an owner creates a specific shared-space invitation; sharing is outside the first MVP.

Do not imply that guest data is saved across devices or sessions unless that behavior is implemented and tested.

## First-session flow
1. **Welcome:** explain SANDAR in one sentence and show the main tasks.
2. **Trust and boundaries:** explain that SANDAR does not know the visitor's circumstances, does not decide eligibility, and is not an emergency or professional-advice service.
3. **Choose a task:** “Atur arus uang”, “Cari layanan atau sumber resmi”, “Jelajahi peluang”, or “Buat rencana sederhana”.
4. **Task explanation:** say what the task will produce and what information may be needed.
5. **Minimum-input step:** ask one useful question per screen where practical. Offer “Lewati”, “Belum tahu”, or a range when safe.
6. **Review:** show all entered facts and assumptions before calculating, saving, or sending to an AI service.
7. **First value:** return a clear summary and a small set of user-controlled next steps.
8. **Save choice:** offer save/export/discard. Explain account and retention requirements before asking the user to sign in.
9. **Return path:** show the last user-selected task only if the user opted into persistence; never create a hidden behavioral profile.

## Consent is contextual
Separate consent by purpose:
- account and authentication;
- storage of private workspace records;
- optional AI processing, with categories of data disclosed;
- optional reminders/notifications;
- optional sharing with a named participant;
- analytics beyond essential security/operations.

One consent must not silently authorize another purpose. Consent records should include purpose, scope, notice version, timestamp, and revocation state.

## Sensitive-data rule
Do not request health, financial-account credentials, identity numbers, exact address, family-member details, or other sensitive information unless a specific user-requested feature demonstrably requires it. The MVP should not require these fields. Never infer them from names, public profiles, social accounts, device signals, or location metadata.

## Authentication timing
- Public explanations and public-resource browsing should not require an account.
- Ask for authentication only when the user chooses a feature that truly needs persistent private storage.
- Explain what is saved, where it is stored, how to export/delete it, and what security records may be retained.
- Do not gate a basic explanation or public-source link behind account creation.

## Onboarding copy principles
Use neutral, direct language. Examples:
- “Apa yang ingin Anda urus lebih dulu?”
- “Informasi ini membantu menghitung perkiraan. Anda bisa melewatinya.”
- “Ini perkiraan berdasarkan angka yang Anda masukkan, bukan keputusan resmi.”
- “Sumber terakhir diperiksa pada …”
Avoid “profil risiko”, “Anda bermasalah”, “wajib isi semua”, or urgency pressure.

## Acceptance criteria
- A visitor can understand the product without signing in.
- A user can choose one task without completing a profile.
- Every requested field has a visible purpose.
- Optional fields can be skipped without penalty.
- No external AI call or third-party disclosure occurs before the relevant consent and review.
- The user can inspect and correct inputs before a result is produced.
- The save path clearly distinguishes guest/local state from server-persisted state.
- No dark patterns, forced streaks, guilt prompts, or misleading progress indicators.
