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
- User selected onboarding@resend.dev and configured the private API key. A live test through the app transport was accepted by Resend, and the user confirmed inbox receipt. This sender reaches only the Resend account email. Live reset/invoice flow checks need a matching Brightloop user/customer.
- Invoice Send records provider acceptance rather than only updating a timestamp. Development reset previews remain an explicit local-only opt-in. Delivery failures, privacy and retry behavior have automated tests with no real email sends.
- Email verification, durable session revocation, a durable mail outbox and delivery webhooks remain separate work.

## Dependencies
- Needs the schema from Ryyan (about 30 minutes in). Start with auth screens and validation while waiting.
- Use Fathima's components in `src/components/**`; request missing ones via a handoff note.

## Acceptance
- A customer cannot read another customer's invoice by editing the URL.
- All auth input errors show clear messages.

## First prompt
"Read AGENTS.md and docs/kickoff/pankaj.md. I own the paths listed for pankaj. Build deliverable 1 and 2 first, with validation and tests for the password rules. Do not touch other owners' files."
