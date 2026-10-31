# Pankaj — auth, roles, customer portal, subscriptions UI

## Deliverables
1. Signup/login: unique email; password longer than 8 characters with an uppercase letter, a lowercase letter and a special character; zod validation, hashed passwords (bcrypt/argon2), cookie session.
2. Password reset: token table or signed token, link sent by a dev mailer (log the link to the console and show it on screen in dev), expiry.
3. `src/proxy.ts` plus `requireRole()` helper used by every API route. Only ADMIN can create STAFF (`/admin/staff`). STAFF are limited. CUSTOMER sees only their own data.
4. Customer portal `/portal`: own subscriptions and invoices, close/renew actions that call Ryyan's APIs.
5. Subscriptions UI `src/app/(app)/subscriptions/**`: list with filters, form (customer, plan, template, lines), a status bar showing Draft → Quotation → Confirmed → Active → Closed with transition buttons.

## Dependencies
- Needs the schema from Ryyan (about 30 minutes in). Start with auth screens and validation while waiting.
- Use Fathima's components in `src/components/**`; request missing ones via a handoff note.

## Acceptance
- A customer cannot read another customer's invoice by editing the URL.
- All auth input errors show clear messages.

## First prompt
"Read AGENTS.md and docs/kickoff/pankaj.md. I own the paths listed for pankaj. Build deliverable 1 and 2 first, with validation and tests for the password rules. Do not touch other owners' files."
