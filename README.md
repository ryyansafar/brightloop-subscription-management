# Brightloop Subscription Management System

Odoo x Make-A-Ton 9.0 Kochi Hackathon 2026, virtual round.

One platform for plans, subscriptions and recurring billing: products and variants, plans, quotation templates, subscriptions, invoices, payments, discounts, taxes, role-based access and a finance dashboard.

## Stack
Next.js (App Router), TypeScript, Prisma, SQLite, Tailwind, zod.

## Run
```
npm install
cp .env.example .env
npx prisma migrate dev
npm run seed
npm run dev
```
Open http://localhost:3000. Demo logins (password `Demo@12345`): `admin@brightloop.test`, `staff@brightloop.test`, `customer@brightloop.test`.

## Roles
- **Admin**: full control, adds staff, manages catalog, taxes and discounts.
- **Staff**: day-to-day subscriptions, invoices and payments, limited access.
- **Customer**: portal with their own subscriptions and invoices only.

## Data model
See `prisma/schema.prisma`. Money is stored as integer paise, tax and percent discounts as basis points. Invoices are unique per subscription period, so a period is never billed twice.

## Team workflow
See `AGENTS.md` and `docs/kickoff/`.
