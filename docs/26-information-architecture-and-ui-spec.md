# 26 — Information Architecture and UI Specification

## Navigation model
Keep top-level navigation small:
- **Beranda** — product explanation and task entry points.
- **Ruang Saya** — private user-owned plans (show only when applicable).
- **Jelajahi** — public services, resources, and opportunities.
- **Pengaturan & Privasi** — account, consent, export, deletion, accessibility.

Module names may appear as task categories, not as six equally prominent dashboards. Avoid overwhelming first-time visitors with every capability.

## Home screen hierarchy
1. Clear product statement.
2. Short privacy and agency statement.
3. Primary task cards:
   - Atur arus uang
   - Cari layanan/sumber resmi
   - Jelajahi peluang
   - Buat rencana ke depan
4. “Cara kerja” with a three-step explanation.
5. Limits and emergency/professional-service disclaimer.
6. Footer with privacy, terms, accessibility, and contact route.

## Task page template
Every task page follows this order:
1. Page title phrased as the user's task.
2. One-sentence outcome.
3. What the tool does and does not do.
4. Minimum input form.
5. Inline explanation for non-obvious fields.
6. Review/edit step.
7. Result with facts, calculations, and suggestions visually separated.
8. Next-step actions controlled by the user.
9. Save/export/delete choices where supported.

## Interaction specification
- One primary action per screen.
- One question per page for complex forms; combine only when usability testing shows the questions are simple and related.
- Use progressive disclosure for optional detail.
- Keep entered values when navigating back.
- Distinguish required and optional fields.
- Provide “Tidak tahu”, “Lewati”, and “Gunakan perkiraan” only where the calculation or workflow can safely handle them.
- Never preselect a consequential option.
- Destructive actions require a clear summary of what will be deleted and a final confirmation.
- Do not use progress bars for a short task unless testing shows they help.

## Visual hierarchy and content
- Calm, legible, high-contrast interface.
- Use plain Bahasa Indonesia first; define unavoidable technical terms.
- Do not rely on color alone for status.
- Use text labels such as “Terverifikasi”, “Perlu diperiksa”, “Informasi lama”, and “Belum diketahui”.
- Clearly label user-entered values, system calculations, public-source facts, and AI suggestions.
- Show the date and source near the relevant public fact, not hidden in a footer.
- No streaks, manipulative urgency, shame language, or vulnerability badges.

## Responsive and accessibility requirements
Target WCAG 2.2 AA as a design target:
- semantic headings and landmarks;
- keyboard-operable controls and visible focus;
- programmatic labels and helpful error messages;
- adequate contrast and zoom/reflow support;
- screen-reader announcements for dynamic results and errors;
- reduced-motion support;
- touch targets and readable line lengths;
- no essential interaction that depends only on hover.

## UI states required for each data view
- initial/empty;
- loading;
- success;
- validation error;
- permission denied;
- offline/network error;
- stale or unavailable source;
- partial result;
- save pending/success/failure;
- deletion pending/success/failure.

## Content examples
Prefer:
- “Belum ada data untuk periode ini.”
- “Angka ini berasal dari informasi yang Anda masukkan.”
- “Sumber belum dapat diperiksa kembali.”
- “Periksa kembali ketentuan pada situs penerbit.”

Avoid:
- “Anda gagal mengelola uang.”
- “Anda termasuk kelompok rentan.”
- “Pasti memenuhi syarat.”
- “Kesempatan terakhir—bertindak sekarang.”

## Acceptance criteria
Every screen has a clear task, a clear next action, and an understandable exit. Keyboard-only and screen-reader flows must be tested before public release.
