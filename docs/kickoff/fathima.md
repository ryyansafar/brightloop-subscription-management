# Fathima — app shell, shared components, dashboard, invoices/payments UI, seed data

## Deliverables
1. `src/components/**`: sidebar layout, page header, status bar (steps with current highlighted), data table with filters and pagination, form field with error display, buttons, toasts. Responsive. One palette, one type scale. Odoo-style: sidebar, list and form views. Push this first; the others depend on it.
2. `src/app/(app)/layout.tsx`: sidebar menu by role (hide what the role cannot use).
3. Dashboard `src/app/(app)/dashboard/**`: active subscriptions, MRR, ARR, revenue, payments received, outstanding, overdue invoices, churned. Filters by date range and plan, summary view and a simple chart. Use SQL aggregates, no loading all rows.
4. Invoices and payments UI: list with paid/outstanding/overdue filters, invoice form with lines, confirm/cancel/send/print buttons (print via a print stylesheet), record payment dialog.
5. `prisma/seed.ts`: realistic Brightloop data: 1 admin, 2 staff, ~50 customers, ~3,000 subscriptions across plans and statuses, invoices and payments, with demo logins. Use faker. Also verify page load under 2 seconds.

## Dependencies
- Schema from Ryyan (about 30 minutes in). Build components and layout first; they do not need it.
- Invoice and payment actions call Ryyan's API routes.

## Acceptance
- Dashboard numbers match a manual SQL count on seeded data.
- Layout works at phone width with no horizontal scroll.

## First prompt
"Read AGENTS.md and docs/kickoff/fathima.md. I own the paths listed for fathima. Build deliverable 1 (shared components and layout shell) first. Keep each file under 200 lines."
