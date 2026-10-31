# Authentication backend contract

The frontend is deliberately deferred. No layouts, screens, shared components, or styles were changed.

## Local configuration

Add these to your local `.env` (do not commit the generated secret):

```dotenv
AUTH_SESSION_SECRET=<random secret, at least 32 characters>
APP_ORIGIN=http://localhost:3000
AUTH_DEV_BYPASS=0
```

Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Every app process must use the same secret. Set APP_ORIGIN to the public HTTPS origin behind a reverse proxy. Changing the secret invalidates all current sessions.

Use the existing Prisma migrations; this implementation needs no schema changes. Sessions use an eight-hour, host-only, HttpOnly, SameSite=Lax cookie (`Secure` in production). The signature covers user ID, expiry and a password-hash fingerprint. Password changes invalidate existing cookies; current roles are loaded from the database. Logout clears the browser cookie; an independently copied cookie remains usable until expiry or password reset. Server-side per-session revocation would require a session table.

## Routes

All bodies are JSON. Responses follow `{ ok: true, data }` or `{ ok: false, error }`; auth responses use `Cache-Control: no-store`. Validation errors identify the field. Public signup cannot supply a role.

| Method | URL | Body / response |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{ name, email, password }` → public user and session cookie; creates linked Customer |
| POST | `/api/auth/login` | `{ email, password }` → public user and session cookie |
| POST | `/api/auth/logout` | No body needed; clears cookie |
| GET | `/api/auth/me` | Session required → `{ id, email, role }` |
| POST | `/api/auth/forgot-password` | `{ email }` → generic message; in development, existing accounts also get `devResetUrl` |
| POST | `/api/auth/reset-password` | `{ token, password }` → confirmation, clears cookie; login required afterwards |
| POST | `/admin/staff/accounts` | ADMIN session required; `{ name, email, password }` → STAFF user; keeps the admin's session |

Routes under `(auth)` use the `/api/auth/*` URL namespace so future `/login`, `/signup`, `/forgot-password`, and `/reset-password` pages can be added without route/page collisions. `/admin/staff/accounts` similarly leaves `/admin/staff` free for the staff screen.

Password rules: at least nine characters, uppercase and lowercase letters, a non-whitespace special character, and at most 72 UTF-8 bytes (bcrypt's limit). Emails are trimmed and lowercased. Signup creates User and Customer in one nested database write; unique email conflicts return 409. Passwords use bcrypt cost 12.

Reset links expire after 30 minutes; only SHA-256 token hashes are persisted. Issuing a new link invalidates earlier links. Consuming a token and changing the password run in a transaction with a conditional one-time update. The dev mailer logs and returns the URL; the future reset screen should read the URL's `token` and POST it with the new password. Development disclosure is intentional for this hackathon. Production recovery returns 503 until a real mail transport is configured and never logs/returns tokens.

## Roles and portal integration

Existing subscription/invoice/payment/billing APIs now resolve real session cookies through `src/lib/api-auth.ts`. Header identities (`x-dev-role`, `x-dev-user-id`) are accepted only when NODE_ENV=test and AUTH_DEV_BYPASS=1; a running development or production server always ignores them. Tests for real sessions explicitly disable the bypass.

`requireRole(request, roles)` is available for new route handlers. Existing APIs already enforce roles through `handle()`. The proxy redirects unsigned protected page requests to `/login?next=<internal path>`, sends customers to `/portal` when they try staff pages, and restricts admin pages to ADMIN. Route handlers must always authorize independently of the proxy. Future server actions must do the same.

The future portal should call these existing APIs with browser cookies:

- `GET /api/subscriptions` and `GET /api/subscriptions/{id}`
- `GET /api/invoices` and `GET /api/invoices/{id}`
- `POST /api/subscriptions/{id}/transition` with `{ "to": "CLOSED", "closeReason": "..." }`
- `POST /api/subscriptions/{id}/renew` with `{}`

The backend restricts CUSTOMER queries to the Customer linked to the signed-in User. Other customers' record IDs return 404. Customers can close/renew their own subscriptions but cannot pause or advance their lifecycle. Billing runs require ADMIN; STAFF cannot create staff. Money remains integer paise and dates serialize to ISO strings.

## Verification and operational boundaries

Tests cover validation, hashing, normalized email uniqueness, session tampering/expiry, role changes, password changes, token expiry/replay/concurrent redemption, staff creation, browser origin checks, and customer row ownership using real signed cookies. Run `npm test`, `npx next typegen`, `npx tsc --noEmit`, and `npm run lint`.

Auth mutations reject foreign Origin / cross-site browser headers, including existing billing APIs through resolveUser. Signup, login, and reset requests are limited to ten attempts per normalized email/action per 15 minutes in a bounded in-memory map. This hackathon limiter is per process and resets on restart; use a shared rate-limit store for multiple instances.
