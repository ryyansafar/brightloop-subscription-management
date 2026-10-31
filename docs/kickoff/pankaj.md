# Pankaj — auth, roles, customer portal, subscriptions UI

## Deliverables
1. Signup/login: unique email; password longer than 8 characters with an uppercase letter, a lowercase letter and a special character; zod validation, hashed passwords (bcrypt/argon2), cookie session.
2. Password reset: token table or signed token, link sent by a dev mailer (log the link to the console and show it on screen in dev), expiry.
3. `src/proxy.ts` for page protection. For the API, replace the body of `resolveUser()` in `src/lib/api-auth.ts` (Ryyan's routes already call it through `handle()`, which enforces roles). Only ADMIN can create STAFF (`/admin/staff`). STAFF are limited. CUSTOMER sees only their own data.
4. Customer portal `/portal`: own subscriptions and invoices, close/renew actions that call Ryyan's APIs.
5. Subscriptions UI `src/app/(app)/subscriptions/**`: list with filters, form (customer, plan, template, lines), a status bar showing Draft → Quotation → Confirmed → Active → Closed with transition buttons.

## Current integration update — 31 October 2026
- Core deliverables above are implemented, integrated and pushed. Shared Sign out and System/Light/Dark controls are available.
- Real password-reset and invoice email delivery is now implemented using Resend; configuration and test-sender restrictions are in docs/EMAIL.md. Live delivery awaits the user's provider account, API key and approved sender. No credentials are committed.
- User selected onboarding@resend.dev and configured the private API key. Live password-reset and invoice-email flows are confirmed: the reset token was consumed after the private password change; the user received the invoice email and opened its protected link. This sender reaches only the Resend account email.
- Invoice Send records provider acceptance rather than only updating a timestamp. Development reset previews remain an explicit local-only opt-in. Delivery failures, privacy and retry behavior have automated tests with no real email sends.
- Application hardening is implemented: email ownership verification (live confirmed), durable account-wide logout, atomic database-backed shared rate limits, encrypted mail outbox/retries, private API responses and bounded/validated inputs. See docs/HARDENING.md. Deployment, domain setup and demo materials were explicitly excluded; the Resend test sender remains restricted to the provider account email. Delivery webhooks remain an optional provider integration.
- Final portal audit: production HTTP checks completed for own, foreign, nonexistent and invalid invoices plus signed-out redirect. Foreign invoice data was absent and the streamed 404/not-found payload plus noindex was present. Portal payment labels use the shared helper; signup API field names and strict extra-key policy are documented.

## Dependencies
- Local development refresh-loop fix: Tailwind scans and registers loader dependency contexts under `src/` only. SQLite writes from authentication, tests and the mail worker must not act as CSS source updates. Keep the explicit source/base settings when changing the build configuration.
- Needs the schema from Ryyan (about 30 minutes in). Start with auth screens and validation while waiting.
- Use Fathima's components in `src/components/**`; request missing ones via a handoff note.

## Acceptance
- A customer cannot read another customer's invoice by editing the URL.
- All auth input errors show clear messages.

## First prompt
"Read AGENTS.md and docs/kickoff/pankaj.md. I own the paths listed for pankaj. Build deliverable 1 and 2 first, with validation and tests for the password rules. Do not touch other owners' files."
