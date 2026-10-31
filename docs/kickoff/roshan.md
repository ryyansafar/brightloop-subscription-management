# Roshan — catalog: products, variants, plans, taxes, discounts, templates

## Deliverables
1. Products CRUD: name, type, sales price, cost price, notes. Variants by attribute (e.g. brand), each with an extra price (Odoo brand = +560).
2. Plans CRUD: price, billing period (daily/weekly/monthly/yearly), min quantity, available-from/to, flags: auto-close at end, closable, pausable, renewable.
3. Tax rates CRUD (admin only).
4. Discounts CRUD (admin only): fixed or percent, min purchase or quantity, start/end dates, usage limit, scope product or whole subscription. Export `getApplicableDiscounts(line, subscription, date)` from `src/lib/discounts.ts`; Ryyan's billing engine will call it.
5. Quotation templates: plan + product lines + validity in days.

## Dependencies
- Schema from Ryyan (about 30 minutes in). Until then, write zod validators and the discount-rule function against a plain TypeScript type.
- Use Fathima's list/form components; request missing ones via a handoff note.

## Acceptance
- Negative prices, end before start, percent over 100, and usage limit below 0 are rejected with clear messages.
- Only ADMIN can create discounts and taxes (use Pankaj's `requireRole()`).

## First prompt
"Read AGENTS.md and docs/kickoff/roshan.md. I own the paths listed for roshan. Start with the zod validators and the discounts rule function with unit tests, then the CRUD routes once prisma/schema.prisma is on main."
