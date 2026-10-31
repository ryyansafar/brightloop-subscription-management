# Application hardening — 31 October 2026

Scope: application code only. The user excluded deployment, domain purchase/verification and demo work, and chose to keep Resend's account-email-only test sender.

## Update an existing checkout

Stop app and mail-worker processes before regenerating Prisma on Windows. Back up the database, then run:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Do not run a seed/reset to apply these migrations. The additive migrations introduce session generations, email verification, shared rate counters and the mail outbox. The local dev.db was backed up to the ignored .local-backups directory before migration; user data and passwords were preserved.

## Email ownership

Set AUTH_REQUIRE_EMAIL_VERIFICATION=1. Production defaults to requiring verification when this variable is absent. Explicit 0 is for controlled local/test setups, not public onboarding. New public accounts receive no session cookie until they verify their address and sign in with their password. Signup fails before account creation if required verification delivery is not configured.

Verification links last 60 minutes, are single use, and are bound to the email stored when issued. Only token hashes are stored in EmailVerification. Resending invalidates older tokens and queued messages. The URL fragment keeps verification tokens out of HTTP page requests/referrers. Both token-bearing page paths suppress Next's development request logs and set no-referrer policy. GET never consumes a token: the person explicitly presses Verify email. API requests use the same origin/body/source limits as other auth mutations.

Existing pre-migration users retain an explicit legacy exemption (emailVerificationRequired=false); they are not falsely marked verified. Synthetic .test seed accounts also have that explicit demo exemption. Admin-created staff accounts are trusted provisioning and exempt from public signup verification. A successful verification or password reset records emailVerifiedAt. Existing legacy accounts can use the verification page to establish ownership without changing their password.

The Resend test sender still cannot send to arbitrary new users. Without a verified domain, use only the account address Resend permits; other new accounts remain unverified until their mail can be delivered. This provider limitation is not bypassed.

## Durable logout

Every cookie includes the account's sessionVersion generation. Every authenticated request checks the current database generation as well as expiry, signature, current role, password version and verification requirement. Sign out increments the database generation and invalidates all currently issued cookies, including copies on other devices. A copied revoked cookie cannot invalidate a later fresh login. Password reset also increments the generation.

This is account-wide logout, not a per-device session manager. It survives application restarts. No evictable in-memory revocation list is used.

## Shared authentication limits

The existing source/account limits now use AuthRateLimit in the application database. One conditional SQL upsert enforces each budget atomically across processes connected to the same database. Limits survive restarts; indexed expiry cleanup removes old counters without evicting live budgets. Storage/database failures return 503 rather than bypassing limits. Raw client addresses are not stored in the counter key.

The configured source budget remains 40 requests per 15 minutes; each source/email/action gets ten attempts. Successful login clears only its own account counter. Production/public ingress must still overwrite AUTH_TRUSTED_IP_HEADER and prevent direct backend access. Local loopback development uses its shared source bucket.

SQLite workers must use the same database file. Separate databases on separate hosts do not share counters. This task does not deploy a multi-host database, ingress or WAF.

## Durable mail retry worker

Start the app and worker in separate terminals:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
npm run mail:worker
```

Useful worker commands:

```powershell
npm run mail:worker -- --once
npm run mail:worker -- --status
```

The worker loads the private .env, polls every ten seconds and reports aggregate status only. The queue survives worker/app restarts. Application requests attempt delivery immediately; transient failures become PENDING. Invoice API responses distinguish accepted from queued, and sentAt changes only after provider acceptance. Running the worker is required for unattended retries.

Encrypted payloads preserve the original sender, recipient, body and idempotency key across retries. AES-256-GCM uses a domain-separated key derived from AUTH_SESSION_SECRET. No extra hosted service or secret is needed. Rotating the session secret also invalidates pending encrypted mail; drain the queue before planned rotation or request fresh notices afterwards. Payloads are erased after acceptance, expiry or terminal failure. Terminal metadata is retained for seven days and then cleaned up.

A database lease prevents competing workers from claiming a job together, and expired leases are recoverable. Conditional lease ownership prevents a stale worker from overwriting a newer worker. Provider idempotency handles ambiguous network/database failures. Retries use exponential backoff, honor Retry-After up to one hour and stop after at most six attempts. Token expiry can stop them earlier. Invoice jobs expire within 12 hours, keeping automatic retries inside Resend's 24-hour idempotency retention window.

Expired/superseded/consumed links, cancelled invoices and notices whose recipient changed are not sent. Permanent provider rejection is not automatically retried. An explicit Send after a failed invoice notice starts a new bounded logical attempt. Acceptance is not proof of inbox delivery: inspect Resend's dashboard for bounces. Delivery webhooks and a bounce-suppression management UI are not part of this change.

## Other API boundaries

Shared success/error responses use private, no-store. Unexpected exceptions are logged by class only, validation omits unknown field names, pagination uses bounded safe integers, and payment date/id filters reject malformed or reversed ranges. Date-only payment end filters include the whole UTC day.

## Verification

Regression coverage includes copied-cookie logout/fresh login, new signup gating, token expiry/replay/concurrent consumption/address binding, independent database clients sharing a rate budget, limiter persistence/capacity, encrypted payloads, concurrent workers, lease recovery, provider backoff, retry exhaustion, failed invoice timestamps, stale jobs and API input/privacy checks. Tests use disposable test.db and mocked mail; the existing local data is not reseeded.

Final verification: 376 tests across 35 files, lint, TypeScript and production build passed. Fresh migration/seed compatibility was checked in a separate disposable database. Live email verification was confirmed by the user and by a consumed token/emailVerifiedAt check. The local migration preserved existing password hashes, invoice count and customer count compared with the pre-migration backup.
