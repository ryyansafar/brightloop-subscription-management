# Frontend integration — 31 October 2026

Current status: the frontend, shared logout/themes and route consolidation were pushed through 8bcdcc4 with explicit authorization. Resend recovery/invoice mail is now implemented; provider activation/live delivery remains pending user configuration (docs/EMAIL.md). The original planning and verification record below is historical.

The user resumed UI work and authorized pushing the saved authentication/security changes. That commit was synced with main and pushed as 6ef3381 before frontend work began. Future frontend pushes still need separate user authorization.

## Design and ownership

- References: stitch_preview/2_subscription_detail.html and stitch_preview/6_customer_portal.html, with the remaining preview suite as cross-page context.
- Reuse Fathima's AppShell, PageHeader, form fields, buttons, badges, table controls, dialogs and toasts. Use global semantic tokens; do not introduce a separate page-specific palette or rewrite shared components.
- Keep mutations in the existing authenticated APIs. Server-rendered page reads check roles and customer ownership independently of layouts/proxy.
- No fabricated payments, saved cards, plan upgrades or email delivery from the static preview: only implement behaviors supported by the backend.

## Chunks

- [x] Login, signup, forgot/reset-password screens, safe return paths and sign-out control.
- [x] Admin-only staff list and creation form.
- [x] Subscription list/filter, creation from customer/plan/template/product lines, detail and status actions.
- [x] Customer portal, scoped subscription/invoice details and close/renew actions.
- [x] Verify client validation, permissions, desktop/mobile layout, real actions, TypeScript, lint, tests and production build.
- [x] Record handoff for shared-shell styling/navigation and backend contract gaps.

## Verified result

- All 178 tests pass across 15 files, including safe return-path cases and independent server-page customer ownership tests. TypeScript, lint, whitespace checks and the production build pass.
- Real browser checks on 1280px desktop and 390px mobile: login validation, role routing, signup to an empty portal, development recovery links and incomplete-link handling, staff restrictions, explicitly approved staff creation, creation from a template with variants/tax/end date, lifecycle transitions, pause/resume, invoice generation, customer invoice details, cross-customer 404, renewal and close-reason validation.
- Fixed issues found during verification: native date input commit timing, stale sign-out loading state, missing page-level Suspense boundaries, and mobile intrinsic grid overflow.
- Browser work used only prisma/frontend-review.db, seeded specifically for this task. The user's dev.db was not modified. The approved review staff account exists only in that isolated database. The temporary review server was stopped after verification.
- Password-reset submission is covered by the existing API tests; browser verification covers link delivery, the form and invalid-link states without changing an existing account's password in the browser.
- Security commit 6ef3381 is pushed. Frontend work is saved locally and requires separate approval before a push.
