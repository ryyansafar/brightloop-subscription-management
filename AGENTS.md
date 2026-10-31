# Team rules — read this first, every session

Project: Brightloop Subscription Management System (hackathon, 8-hour round).
Stack: Next.js (App Router) + TypeScript + Prisma + SQLite + Tailwind.
Run: `npm install && npx prisma migrate dev && npm run seed && npm run dev`

## Git (one branch only)
- Everyone commits straight to `main`. No feature branches.
- Before starting work and before every push: `./scripts/sync.sh <yourname>` (pull --rebase + prints new handoff notes).
- Commit your own work, small and often, push at least hourly. Format: `feat: ...`, `fix: ...`, `chore: ...`.
- Never force-push. Never rewrite history.

## Ownership (edit only your own paths)
| Owner | Paths |
|---|---|
| ryyan | `prisma/**`, `src/lib/{db,money,dates,billing,pricing,discount-usage,errors,state,subscriptions,invoices,payments,api}.ts`, `src/test/**`, `src/app/api/{subscriptions,invoices,payments,billing}/**` |
| pankaj | `src/lib/api-auth.ts` (resolveUser only), `src/lib/auth/**`, `src/proxy.ts`, `src/app/(auth)/**`, `src/app/portal/**`, `src/app/admin/staff/**`, `src/app/(app)/subscriptions/**` |
| roshan | `src/lib/catalog/**`, `src/lib/discounts.ts`, `src/app/api/{products,plans,taxes,discounts,templates}/**`, `src/app/(app)/catalog/**` |
| fathima | `src/components/**`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/**`, `src/app/(app)/{invoices,payments}/**`, `prisma/seed.ts` |

Need a change in someone else's path? Do not edit it. Write a handoff note tagging the owner.

## Handoff notes (the automation)
- After pushing anything others depend on (new function, changed schema, renamed route, new env var): `HANDOFF_USER=<name> ./scripts/handoff.sh`, fill the file, commit, push.
- `./scripts/sync.sh <name>` prints every new note since your last sync and highlights the ones tagging you. Act on those first.

## Conventions
- Money: integer paise everywhere, format only in the UI (`src/lib/money.ts`).
- Dates: ISO strings in the API, `Date` in the DB.
- Subscription status: DRAFT, QUOTATION, CONFIRMED, ACTIVE, CLOSED (plus PAUSED). Invoice status: DRAFT, CONFIRMED, PAID, CANCELLED.
- API shape: `{ ok: true, data }` or `{ ok: false, error: string }`. Validate every input server-side (zod).
- Roles: ADMIN, STAFF, CUSTOMER. Enforce on the server, not just in menus.
- UI uses Odoo vocabulary: MRR, ARR, In Progress, To renew, Churned.
- Understand every line you commit. Adapt generated code; you may be asked to explain it.

## Next.js 16 note
This Next.js version differs from older docs. Before writing route, proxy or caching code, read the matching guide in `node_modules/next/dist/docs/`. Request interception lives in `src/proxy.ts` (formerly middleware).

## First-time setup (everyone)
```
git pull
npm install
npm run setup:env
npx prisma migrate dev && npm run seed
npm run dev
```
Demo logins (password `Demo@12345`): admin@brightloop.test, staff@brightloop.test, customer@brightloop.test.
If the schema changed, a handoff note will say so: pull, then `npx prisma migrate dev`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
