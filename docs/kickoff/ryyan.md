# Ryyan — schema, billing engine, subscription/invoice/payment APIs

Deadline for the core: **1:30 PM** (you leave for the 2:30 session). Push the schema first so everyone can start.

## Deliverables (in order)
1. `prisma/schema.prisma`: users, customers, products, variant options (extra price), plans, quote templates + lines, subscriptions + lines, tax rates, discounts (used_count, usage_limit), invoices (`@@unique([subscriptionId, periodStart])`) + lines (price/tax/discount snapshot), payments. Indexes on `subscriptions(status,nextInvoiceDate)`, `invoices(status,dueDate)`, `payments(paidOn)`. Push within 30 minutes and write a handoff note.
2. `src/lib/{money,dates,state}.ts`: paise helpers, add-period with day clamp, status transition tables.
3. `src/lib/billing.ts`: billing run. Loop due subscriptions, derive the period from `nextInvoiceDate`, skip if the invoice exists, apply best discount (date window, min qty/amount, usage limit, atomic count), tax per line half-up, snapshot lines, advance `nextInvoiceDate`, auto-close past `endDate`.
4. API routes: subscriptions (create from template, transitions), invoices (generate, confirm, cancel, send, print), payments (record, mark paid, reject overpayment), `POST /api/billing/run`.

## Acceptance
- Running billing twice creates no duplicate invoices.
- An exhausted or expired discount stops applying.
- Invalid status transitions return `{ ok: false, error }`.

## First prompt
"Read AGENTS.md. I own the paths listed for ryyan. Build deliverable 1 only (the Prisma schema with the constraints in docs/kickoff/ryyan.md), run a migration against SQLite, and stop."
