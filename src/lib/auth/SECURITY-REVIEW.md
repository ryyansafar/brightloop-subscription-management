# Security review — 31 October 2026

Historical review below: frontend and security work have since been pushed with user authorization. Resend mail integration now supports real recovery/invoice delivery when configured; see docs/EMAIL.md. Real recovery tokens remain absent from responses/logs. Email verification, durable session revocation and distributed rate limiting are still separate follow-ups.

Reviewed both supplied reports against the current code and all CUSTOMER-reachable API routes. Changes stay in Pankaj's owned paths. No Git push is authorized or performed. UI development remains paused.

## Confirmed issues fixed here

| Report finding | Assessment and change |
| --- | --- |
| First #1: limiter capacity causes a global outage | Confirmed. Full-map rejection is removed. Each bounded counter evicts the oldest entry, and expires only an insertion-ordered prefix rather than sweeping every live bucket. A regression fills more than 10,000 entries and verifies a new user is accepted. |
| First #2: development reset links fail open | Confirmed for accidentally exposed development servers. Recovery disclosure/logging now needs AUTH_DEV_MAILER=1, exactly NODE_ENV=development and a loopback APP_ORIGIN. Other environments/default configuration return 503 before token issuance or logging. Local developers must bind the server to loopback; Host/origin alone is not evidence of a local network peer. |
| First #3: email rotation amplifies main-thread bcrypt CPU | Confirmed. Password operations now run in Node worker threads, with at most two jobs per process, no waiting queue, a ten-second timeout, and source limits before body parsing/expensive work. The bcrypt format and seeded account compatibility are preserved without new dependencies. |
| First #4: global email lockouts and no source axis | Confirmed. A source has 40 password-endpoint attempts per 15 minutes; account counters are scoped to (source, email, action), capped at ten. Successful login clears its account counter. Trusted ingress configuration is mandatory outside local development; arbitrary forwarding headers are not trusted. The in-memory design is still not a distributed abuse-control service. |
| First #6: identity-header bypass | Environment-dependent risk, not a default development/production bypass. It now additionally requires VITEST=true. Existing owner tests still use the guarded seam; real-session tests disable it. |
| First #7: exposed password-hash fingerprint | The old fingerprint was not an authentication bypass. It is replaced with a domain-separated HMAC marker so cookies no longer contain an unkeyed hash of the stored password hash. Durable logout revocation remains a schema dependency below. Existing sessions must sign in again after this change. |
| First #8: request-derived/fallback trusted origin | Configuration hardening. Trust decisions now use one validated APP_ORIGIN helper, never request.url. Production requires an explicit HTTPS origin, without credentials/path/query/fragment. |
| First #9: missing origin evidence and cookie tossing | Hardened. Production cookie-bearing mutations need a matching Origin or same-origin Fetch Metadata. Auth JSON bodies require application/json. Production cookies use __Host-brightloop_session; duplicate session cookies are rejected. |
| First #10: NUL password characters | Rejected at signup/reset. The nine-character complexity policy remains aligned with the hackathon requirement. Breached-password checks and MFA are additional product/security work, not evidence of a present authorization bypass. |
| First #11: body/error handling | Confirmed missing body bound. Auth JSON is now streamed with a 16 KiB byte cap, independent of Content-Length. Unknown field names are not echoed. Logs retain exception class and recognized Prisma code without raw messages, SQL or credential-bearing objects. Framework control-flow errors are rethrown for Next to handle. |
| Follow-up #1: new pages public by default | Confirmed unsafe default. Page protection now has an explicit public-page list and covers new paths, extension-bearing pages, trailing slashes and Next data paths. Encoded admin path checks use a decoded path. Public assets/API handlers have explicit exclusions. Reset pages also suppress referrers. |

## Verified protections; no current exploit established

- Every existing business API is wrapped by handle() directly or through catalog collection/item handlers. Every auth/staff handler is wrapped by authHandler(). Logout exports POST only.
- Every current CUSTOMER-reachable invoice/subscription/payment read has an ownership condition. Payment filtering is nested through invoice.customer.userId. Regression tests pass another customer's invoice/subscription/customer IDs and verify no other customer's rows are returned. Close and renew check ownership; customer-forbidden actions remain forbidden.
- Reset tokens are cryptographically random, hashed, expire, and are consumed atomically. Concurrent redemption still succeeds only once.
- Staff creation requires ADMIN and goes through the mutation-origin guard. Invite workflows, recent reauthentication and persistent audit trails are useful additions, rather than fixes for a demonstrated privilege bypass.
- The referenced historical middleware CVE is not established by these reports as an exploit of this installation. No claim of a complete framework/dependency vulnerability audit is made.

## Remaining work requiring other owners

AGENTS.md says: "Need a change in someone else's path? Do not edit it. Write a handoff note tagging the owner."

| Finding | Remaining action / owner |
| --- | --- |
| First #5: signup enumeration and unverified emails | @ryyan: plan email verification (verified timestamp/token persistence) before production public onboarding or outbound customer mail. Signup currently returns a documented 409 for duplicate emails and does not prove address ownership. Creating an unverified new user does not grant existing customers' records. No Google/OAuth linking exists; future linking must use provider identity, not unverified email alone. Invoice "send" currently updates sentAt and does not deliver email. Generic signup messaging needs an actual verification/mail workflow, not a misleading success response that prevents account recovery. |
| First #7: copied sessions survive logout | @ryyan: add durable Session records for per-session logout revocation, or User.sessionVersion for all-session invalidation (plus disabledAt if account disabling is required). Current logout clears the browser cookie; copied cookies still work until expiry, password change, account deletion or key rotation. Password-change invalidation and live role lookup already work. Do not replace this with an evictable in-memory blacklist that implies durable revocation. |
| Follow-up #3: shared API cache/log behavior | @ryyan: add private, no-store to ok()/fail() in src/lib/api.ts and redact raw caught errors like authHandler(). Next route handlers are uncached by default, so absent headers alone do not demonstrate an existing CDN leak; explicit private/no-store prevents intermediary mistakes. |
| Follow-up #4: pagination arithmetic | @ryyan: validate/clamp page and limit with safe integers and cap skip/page in src/lib/api.ts; validate payment date filters. Hostile values can currently cause authenticated Prisma errors/500s. |
| First #12 / follow-up #2: future pages/actions/ownership | @fathima @ryyan @roshan: keep per-page/data-access/server-action authorization independent of proxy/layout rendering, and require ownership in every future customer query. Current route ownership tests pass; future omission is an architectural risk. |
| Shared rate limiting / deployment | @ryyan/infrastructure: use a trusted ingress that overwrites the configured client-IP header and prevents direct backend access; deploy a shared rate limiter/WAF before multi-instance/public exposure. Local counters and capacity eviction cannot stop a distributed attack. |
| Worker packaging | Runtime dependency bcryptjs and Node worker_threads must be available. Normal next start with installed dependencies is verified. A future minimal/standalone artifact needs bcryptjs in its traced files or an explicit outputFileTracingIncludes rule. |

Do not deploy seeded demo passwords as real production accounts. Production email verification, real recovery delivery, MFA requirements and account lifecycle policy need a coordinated implementation rather than silently changing the hackathon contract.

## Evidence and verification

- Final verification: 163/163 tests pass across 13 files (41 additional cases beyond the 122-test synced baseline); TypeScript, ESLint, whitespace checks and the default production build pass.
- Tests exercise limiter saturation, cross-source isolation, source validation/spoofed headers, overload slot cleanup, fail-closed mailer configuration, production origin policy, streamed byte limits, safe logs, production cookie prefixes, duplicate cookies, guarded test identities, page matcher behavior and payment ownership.
- A built production server on loopback with only the disposable test DB was exercised over real HTTP: signup 201, profile 200/CUSTOMER, __Host-/Secure cookie, three concurrent logins → 200/200/503, cookie mutation without origin → 403, disabled mailer → 503, foreign Origin → 403, oversized body → 413, new page → login redirect, GET logout → 405, POST logout → 200. No production/user database was used.
- Fresh next typegen and source TypeScript checks pass. Stale generated .next/types/app validators from an earlier webpack build were removed only after checking workspace containment and absence of active Next locks; the default Turbopack production build passes.
- Guidance checked against the [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) and [Node worker_threads documentation](https://nodejs.org/api/worker_threads.html). These inform the review; the findings above come from this repository's code and regression tests.
