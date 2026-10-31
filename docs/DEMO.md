# Demo video script (5 to 6 minutes)

Rules from the event: open-access link, functional flow only, 5 to 6 minutes, submitted by 5:30 PM.

## Before recording
1. `git pull && npm install && npx prisma migrate dev`
2. `npm run seed:full` (3,000 subscriptions, about 15,000 invoices; resets all data)
3. Make sure `AUTH_DEV_BYPASS=0` in `.env`.
4. Rehearse billing day without changing data: `npm run demo:billing`
5. Browser at 100% zoom, one window, notifications off.
6. To retake after a live run, re-run step 2.
7. Run the app on http://localhost:3000 (npm run dev) or set APP_ORIGIN in .env to the exact origin you use; otherwise every Save/Confirm/Record payment is blocked by the origin check with a 403.

Logins (password `Demo@12345`): `admin@brightloop.test`, `staff@brightloop.test`, `customer@brightloop.test`.

## Flow and talk track
| Time | Show | Say |
|---|---|---|
| 0:00 | Title / repo | Brightloop sells everything on subscription and ran it from spreadsheets. One platform now runs plans, subscriptions, billing and reporting. |
| 0:20 | Admin login, dashboard | 3,000 subscriptions and about 15,000 invoices. MRR, ARR, payments, outstanding and overdue in one place, with filters. Pages answer in well under two seconds. |
| 1:00 | Catalog | Product with variants: choosing the Odoo brand adds 560. A plan billing monthly, with a minimum quantity and availability dates. A discount rule: percentage or fixed, minimum quantity, dates, usage limit. Only the admin can create these. |
| 2:00 | New subscription from a quotation template | Template already holds the plan and lines. Status bar moves Draft, Quotation, Confirmed, Active. Anyone on the team can see where it stands. |
| 3:00 | Billing day | Sidebar > Billing run (admin): pick the date, Run billing, read the result cards, then run it again to show zero new invoices. (Command-line version: `npm run demo:billing -- --live`). Thousands of due subscriptions invoiced, customer details, lines, discounts and taxes filled in automatically. Run it again: zero new invoices. Nothing billed twice or skipped. |
| 4:00 | One invoice | Discount applied on its own, tax calculated from rules. Confirm, send, print. Draft, Confirmed, Paid. |
| 4:30 | Record payment | Part payment, then the rest. Overpayment is rejected. Invoice becomes Paid and the dashboard updates. |
| 5:00 | Roles | Staff cannot create staff or discounts. Customer portal shows only their own subscriptions and invoices; a URL for someone else's invoice returns not found. Customer closes or renews their own subscription. |
| 5:40 | Close | Stack, tests, and that every teammate committed their own module. |

## Engineering points to mention (if asked, or in the close)
- Each billing period is unique per subscription in the database, so billing is safe to re-run and missed periods are caught up one at a time.
- Prices, tax and discounts are snapshotted on invoice lines; later edits never change old invoices.
- Money is stored as integer paise; tax and percentage discounts use basis points, rounded half-up.
- Month-end dates keep their anchor day: Jan 31, Feb 28, Mar 31.
- Discount usage counts are updated atomically and returned when an invoice is cancelled.
- Roles are enforced on the server, not only in the menus.
- Over 300 automated tests run against a real SQLite database on every commit.
