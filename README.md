# Brightloop Subscription Management System

Odoo x Make-A-Ton 9.0 Kochi Hackathon 2026, virtual round.

One platform for plans, subscriptions and recurring billing: products and variants, plans, quotation templates, subscriptions, invoices, payments, discounts, taxes, role-based access and a finance dashboard.

## Stack
Next.js (App Router), TypeScript, Prisma, SQLite, Tailwind, zod.

## Run
```
npm install
npm run setup:env
npx prisma migrate dev
npm run seed
npm run dev
```
Open http://localhost:3000. `npm run seed:full` loads 3,000 subscriptions and about 15,000 invoices. Demo logins (password `Demo@12345`): `admin@brightloop.test`, `staff@brightloop.test`, `customer@brightloop.test`.

## Email

Password-reset links and invoice notices can be sent through Resend. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified bare-address `EMAIL_FROM` in your private environment. Mail is disabled by default. See [email setup and testing](docs/EMAIL.md), including free quota and test-sender restrictions. Invoice Send records `sentAt` only after provider acceptance.

For the latest security update, apply migrations and regenerate Prisma before starting the app. New public signups require email verification when `AUTH_REQUIRE_EMAIL_VERIFICATION=1` (production defaults on). Run `npm run mail:worker` alongside the app for durable delivery retries. Logout revokes all current sessions, and authentication limits persist in the shared application database. See [hardening and migration guide](docs/HARDENING.md).

## Roles
- **Admin**: full control, adds staff, manages catalog, taxes and discounts.
- **Staff**: day-to-day subscriptions, invoices and payments, limited access.
- **Customer**: portal with their own subscriptions and invoices only.

## Data model
See `prisma/schema.prisma`. Money is stored as integer paise, tax and percent discounts as basis points. Invoices are unique per subscription period, so a period is never billed twice.

## Team workflow
See `AGENTS.md` and `docs/kickoff/`.

## Tests and demo
```
npm test                   # 300+ tests against a real SQLite database
npm run demo:billing       # billing-day demo on a copy of the data (-- --live to apply)
```
See `docs/DEMO.md` for the recording script.

## Pages
| Role | Pages |
|---|---|
| Everyone | `/login`, `/signup`, `/forgot-password`, `/reset-password` |
| Admin and staff | `/dashboard`, `/subscriptions`, `/invoices`, `/payments`, `/catalog/*` |
| Admin only | `/billing` (run billing), `/admin/staff`, catalog discounts and taxes (edit) |
| Customer | `/portal`, `/portal/invoices`, subscription and invoice detail (own data only) |

Run the app on http://localhost:3000, or set `APP_ORIGIN` in `.env` to the exact origin you use; otherwise every save is blocked by the origin check.
