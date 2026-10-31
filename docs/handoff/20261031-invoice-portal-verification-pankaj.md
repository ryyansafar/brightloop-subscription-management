# 31 October — pankaj: live invoice email and remaining portal checks

## Changed
- Synced main before work; no incoming commits/conflicts. Reviewed the audit handoff and Pankaj kickoff contract.
- Live invoice mail now verified through the normal admin login and invoice Send HTTP APIs. The recipient was the user's authorized Resend account address; it is not recorded here. Provider acceptance updated sentAt, and the user confirmed inbox receipt and successful opening of the protected invoice link.
- Created one clearly labelled zero-value test fixture because the new customer had no invoices: INV-SUB-01501-20261031 (local invoice id 7460, total 0 paise). Used normal subscription lifecycle/invoice services, then closed the test subscription and archived its dedicated test plan/product. nextInvoiceDate is null, so it cannot generate future recurring invoices. The invoice is retained for inspection; no database reset, payment, existing invoice modification or real charge occurred.
- Portal payment history now uses the existing paymentMethodLabel helper, matching the back office (UPI, Bank transfer, Card, Cash).
- Auth README now gives a complete signup JSON example and explains exact name/email/password keys, browser-only confirmation, strict extra-key rejection, the response shape and current Resend recovery behavior.
- Updated kickoff/work-plan/email handoff records to mark both live email flows complete. No credential, cookie, password or private recipient address was printed/committed.
- Corrected the recording checklist: production authentication requires an HTTPS APP_ORIGIN, so npm start behind plain localhost HTTP with the development .env cannot be used for the login demo. Use an HTTPS endpoint for production or loopback development for local HTTP. Reseeding also removes the matching live-mail test account/invoice and requires recreating them before those demo steps.

## Verification
- All 342 tests across 31 files, lint, TypeScript, whitespace and production build pass.
- Ran temporary loopback-only next start on port 3109 and read-only HTTP checks with a valid signed customer test session kept in memory. Own invoice loaded; foreign, nonexistent and invalid invoice requests completed with the custom Not found component payload, framework 404 signal and noindex, with no foreign invoice number exposed. Unsigned requests redirected to login.
- Next's documented streamed behavior keeps HTTP 200 once Suspense streaming starts; that status alone is not a failure. The complete not-found response arrived in 19–37 ms during the final run, rather than remaining only a Loading placeholder. This verifies production response behavior; user separately verified the real emailed own-invoice link opens in their browser.
- Temporary scripts were removed and the production review server stopped. The user's development server remains available.

## Needs action from others
- @ryyan: your signup-field documentation and production foreign-invoice checks are addressed. No change to the not-found component was necessary based on the production response checks.
- @fathima: the portal payment-method label audit item is fixed with your shared helper. No shared styles/components were changed.
- @all: Resend onboarding@resend.dev still reaches only the provider account address. Do not use seeded .test recipients for Send in a live demo. A verified sender domain is required for other customers. Production email verification, durable session revocation, shared rate limiting and mail outbox/webhook work remain separate.
- @all: final demo rehearsal, recording and submission are still operational tasks; this verification does not claim they are completed.

## Breaking / contract changes
- None. UI label and documentation correction only; live verification created the identified zero-value local test fixture.
