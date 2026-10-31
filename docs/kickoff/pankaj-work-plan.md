# Pankaj backend work plan

Frontend work was resumed by the user after the security review. Auth screens, the portal, staff screens and subscription list/form/status actions are now implemented using the shared UI system. See pankaj-frontend-plan.md for the current integration and verification record.

## Chunks

1. **Identity and sessions**: shared Zod validation, bcrypt passwords, atomic customer signup, login/logout/current-user endpoints, signed HttpOnly cookies, database-backed role lookup. Test password rules, duplicates, tampering, and expiry.
2. **Password recovery**: random tokens stored only as hashes, 30-minute expiry, atomic one-time use, invalidate prior tokens and sessions, development mailer. Test expiry, replay, and concurrent redemption.
3. **Authorization and integration**: connect Ryyan's `resolveUser` seam, protect application pages with `src/proxy.ts`, add admin-only staff creation, verify customer isolation and close/renew through existing APIs using real cookies.
4. **Handoff and verification**: document routes and environment setup, run auth tests plus existing tests, TypeScript, lint and build; record integration dependencies for teammates.

## Repository findings

- Prisma already includes User, Customer and PasswordReset; no schema changes are needed.
- Subscription, invoice, payment and billing routes already use the shared API handler and customer ownership filters. Reuse these for the future portal instead of duplicating billing logic.
- Only the body of `src/lib/api-auth.ts:resolveUser` is available for integration; other owners' code is left to handoff notes.
- `npm ci` fails on the committed picomatch lockfile entries. Install locally with `npm install --package-lock=false`; ask the dependency owner to repair the shared lockfile.

## Completion tracking

- [x] Identity and sessions
- [x] Password recovery
- [x] Authorization and integration
- [x] Verification and teammate handoff (existing build blockers recorded in the handoff)
- [x] Pankaj frontend integration (resumed by user; shared global restyling remains with Fathima)
- [x] Resend transport, password-reset email and invoice email integration (see docs/EMAIL.md)
- [x] User configures Resend test account/key/sender; live transport submission accepted
- [x] Confirm actual inbox receipt (user shared the received test email)
- [ ] Run live reset/invoice flows for the matching test account

## Initial backend verification (historical)

All 100 tests pass across nine files (46 new auth/integration tests plus 54 existing tests). On this Windows host, the successful test invocation used `$env:RUST_LOG='info'; npm test` after the Prisma migration engine failed without useful diagnostics. Source TypeScript passed after `npx next typegen`; ESLint passed. The default production build first failed fetching Google Fonts in the restricted environment, then hit an existing Tailwind/Turbopack CSS worker failure with network access. `npx next build --webpack` compiled successfully but its generated route checks rejected the optional context parameter on Ryyan's existing `handle()` helper (`src/lib/api.ts`). That owner must fix the shared handler before a complete production build can pass. No frontend or other owners' files were changed to work around these failures.
