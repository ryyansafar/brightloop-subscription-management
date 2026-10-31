# Authentication backend contract

Frontend integration is now implemented: /login, /signup, /forgot-password, /reset-password, /admin/staff, /subscriptions (including new/detail), and the customer portal with subscription/invoice details. These screens reuse the shared application shell, semantic design tokens, controls, tables and invoice document. Shared navigation provides Sign out and persistent System/Light/Dark controls; the public auth screens share the theme selector. Portal/staff pages live under src/app/portal and src/app/admin/staff to avoid duplicate route-group URLs.

## Local configuration

Add these to your local `.env` (do not commit the generated secret):

```dotenv
AUTH_SESSION_SECRET=<random secret, at least 32 characters>
APP_ORIGIN=http://localhost:3000
AUTH_DEV_BYPASS=0
AUTH_DEV_MAILER=0
EMAIL_PROVIDER=disabled
RESEND_API_KEY=
EMAIL_FROM=
```

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Every app process must use the same secret. APP_ORIGIN is required and must use HTTPS in production; it cannot include credentials, a path, query or fragment. Request Host headers never determine trusted origins. Changing the secret invalidates all current sessions.

Public or production deployments must set `AUTH_TRUSTED_IP_HEADER` to the single-client-IP header supplied by their ingress. The ingress must strip/overwrite that header and prevent direct access to the Node server. The application rejects missing, invalid and list-valued client addresses rather than trusting arbitrary X-Forwarded-For. Without this configuration, password endpoints return 503 outside local development. Local development uses one shared source bucket; it must use a loopback application origin and request hostname.

Use the existing Prisma migrations; this implementation needs no schema changes. Sessions use an eight-hour, host-only, HttpOnly, SameSite=Lax cookie (`Secure` in production). Production uses `__Host-brightloop_session`, which browsers prevent sibling domains from setting with a Domain attribute. Development uses `brightloop_session`. Duplicate session cookies are rejected. The signature covers user ID, expiry and a secret-keyed password-version marker, so it does not expose an unkeyed password-hash fingerprint. Password changes invalidate existing cookies; current roles are loaded from the database. This security update invalidates earlier sessions: sign in again. Logout clears the browser cookie; an independently copied cookie remains usable until expiry or password reset. Durable server-side revocation still requires a schema change.

## Routes

Auth bodies require Content-Type application/json and are limited to 16 KiB of actual streamed bytes, including when Content-Length is absent or false. Responses follow `{ ok: true, data }` or `{ ok: false, error }`; auth responses use `Cache-Control: no-store`. Validation errors identify the field but do not echo unknown field names. Public signup cannot supply a role. Error logs include only the exception class and a recognized Prisma error code, not SQL parameters or credentials.

| Method | URL | Body / response |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{ name, email, password }` → public user and session cookie; creates linked Customer |
| POST | `/api/auth/login` | `{ email, password }` → public user and session cookie |
| POST | `/api/auth/logout` | No body needed; clears cookie |
| GET | `/api/auth/me` | Session required → `{ id, email, role }` |
| POST | `/api/auth/forgot-password` | `{ email }` → generic message; configured Resend sends privately; explicitly enabled local development can return `devResetUrl`; unavailable configuration returns 503 |
| POST | `/api/auth/reset-password` | `{ token, password }` → confirmation, clears cookie; login required afterwards |
| POST | `/admin/staff/accounts` | ADMIN session required; `{ name, email, password }` → STAFF user; keeps the admin's session |

Routes under `(auth)` use the `/api/auth/*` URL namespace so future `/login`, `/signup`, `/forgot-password`, and `/reset-password` pages can be added without route/page collisions. `/admin/staff/accounts` similarly leaves `/admin/staff` free for the staff screen.

### Signup request example

POST `/api/auth/signup` with `Content-Type: application/json` and these exact field names:

```json
{"name":"Example Customer","email":"customer@example.com","password":"ExamplePassword@123"}
```

`name` is the full name, not `fullName`; `password` is not `newPassword`. The API accepts only `name`, `email` and `password`: omit confirmation fields, role, customerId and other extra keys. Password confirmation belongs to the browser form. A successful signup returns HTTP 201 with `{ ok: true, data: { id, email, name, role } }` and sets the session cookie; role is always CUSTOMER. Duplicate email returns 409. Validation errors return 400; unknown field names are deliberately not echoed, so an extra-key-only failure may say `Invalid request`. Browser requests must use the configured APP_ORIGIN.

Password rules: at least nine characters, uppercase and lowercase letters, a non-whitespace special character, no null characters, and at most 72 UTF-8 bytes (bcrypt's limit). Emails are trimmed and lowercased. Signup creates User and Customer in one nested database write; unique email conflicts return 409. Passwords use bcrypt cost 12, executed in worker threads rather than on the HTTP event loop. At most two password workers may run per Node process, with no waiting queue and a ten-second timeout; overload returns 503. Workers use the existing installed bcryptjs dependency, so standalone/minimal deployments must include it and permit Node worker_threads. The current supported runtime is Next's Node server, not an Edge isolate.

Reset links expire after 30 minutes; only SHA-256 token hashes are persisted. Issuing a new link invalidates earlier links. Consuming a token and changing the password run in a transaction with a conditional one-time update. For real delivery set EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM; see docs/EMAIL.md. Provider mode never returns/logs reset URLs, even with AUTH_DEV_MAILER=1. Recovery responses stay generic for unknown accounts and delivery failures; failed sends invalidate that token and log only a fixed failure message.

Local console/on-screen previews require EMAIL_PROVIDER unset/disabled, AUTH_DEV_MAILER=1, NODE_ENV=development, and a loopback APP_ORIGIN (localhost, 127.0.0.1 or ::1). To use them locally, explicitly set the flag and run `npm run dev -- --hostname 127.0.0.1`; never expose this development mode through a public interface or tunnel. A loopback-configured URL cannot prove the socket's peer address in a Web Request. Without a configured real provider or permitted preview, recovery returns 503 before issuing a token. Reset pages receive Referrer-Policy: no-referrer.

## Roles and portal integration

Existing subscription/invoice/payment/billing APIs now resolve real session cookies through `src/lib/api-auth.ts`. Header identities (`x-dev-role`, `x-dev-user-id`) require NODE_ENV=test, VITEST=true, and AUTH_DEV_BYPASS=1 together. A test-labelled process without the Vitest marker ignores them, as do development and production servers. Tests for real sessions explicitly disable the bypass.

`requireRole(request, roles)` is available for new route handlers. Existing APIs already enforce roles through `handle()`. Pages are protected by default; public pages are /login, /signup, /forgot-password, and /reset-password (including their trailing-slash forms). The root / routes unsigned users to /login and signed-in users to their role's workspace, with private/no-store headers. APIs and explicit public/framework assets have separate matcher exclusions. New pages, including paths with file extensions, are protected without extending a prefix list. The proxy redirects unsigned protected page requests to `/login?next=<internal path>`, sends customers to `/portal` when they try staff pages, and restricts admin pages to ADMIN. Route handlers must always authorize independently of the proxy. Server components and future server actions must do the same.

`getCurrentUser()` provides a request-scoped server-page identity with the user's name. `requirePageRole(roles)` independently protects each server-rendered data read. Reads sit behind explicit Suspense boundaries for Next's cache-components/partial-prefetch behavior; no session or customer data is cached across requests. `loginDestination()` validates internal return paths and keeps customers/staff within their allowed areas. Client and server password validation share the same schema, using TextEncoder so byte limits also work in browsers.

The portal uses these existing APIs with browser cookies for mutations and independently scoped server queries for page reads:

- `GET /api/subscriptions` and `GET /api/subscriptions/{id}`
- `GET /api/invoices` and `GET /api/invoices/{id}`
- `POST /api/subscriptions/{id}/transition` with `{ "to": "CLOSED", "closeReason": "..." }`
- `POST /api/subscriptions/{id}/renew` with `{}`

The backend restricts CUSTOMER queries to the Customer linked to the signed-in User. Other customers' record IDs return 404. Customers can close/renew their own subscriptions but cannot pause or advance their lifecycle. Billing runs require ADMIN; STAFF cannot create staff. Money remains integer paise and dates serialize to ISO strings.

## Verification and operational boundaries

Tests cover validation, hashing, normalized email uniqueness, session tampering/expiry, role changes, password changes, token expiry/replay/concurrent redemption, staff creation, browser origin checks, and customer row ownership using real signed cookies. Run `npm test`, `npx next typegen`, `npx tsc --noEmit`, and `npm run lint`.

Auth mutations reject foreign Origin / cross-site browser headers, including existing billing APIs through resolveUser. Production cookie-bearing mutations without Origin require Sec-Fetch-Site: same-origin; scripts using cookies should send the configured Origin explicitly. Password endpoints first enforce 40 attempts per source across endpoints per 15 minutes, before body parsing or bcrypt. Signup/login/recovery also enforce ten attempts per (source, normalized email, action); successful login resets that pair's counter. Another source cannot lock the same email globally. Capacity eviction never rejects all new users, and expiry cleanup no longer scans the entire map on every attempt. The limits and password gate are shared across bundled routes within one process. Limits remain in memory, reset on restart, and can be evicted at capacity; use an ingress/shared rate-limit store for public or multi-instance deployment.

See [SECURITY-REVIEW.md](./SECURITY-REVIEW.md) for the disposition of the supplied reports, regression evidence, and the remaining schema/shared-API work assigned to their owners.
