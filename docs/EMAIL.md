# Transactional email with Resend

Brightloop sends verification links, password-reset links and invoice notices through Resend's HTTPS API. No SDK or additional package is required. The additive hardening migrations now provide an encrypted durable retry queue; apply them before using the updated app (docs/HARDENING.md). Mail is disabled by default, and API keys remain server-side.

## Free services

Checked 31 October 2026: [Resend](https://resend.com/blog/new-free-tier) offers 3,000 transactional emails/month with a 100/day cap. [Brevo](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans) offers 300 sends/day. Resend is integrated here; limits and account policies can change. Do not enable paid overages unless you intend to pay.

## Configure Resend

1. Create your account at [Resend](https://resend.com/).
2. For customer delivery, [add and verify a domain](https://resend.com/docs/dashboard/domains/introduction) using the DNS records Resend supplies. Choose a sender on that domain, for example accounts@mail.your-domain.com. DNS ownership/domain registration is separate from the free email quota.
3. Create a sending-only API key, restricted to the sending domain where available.
4. Add these values to your local `.env` and deployment secret settings. Never commit the real API key or use a NEXT_PUBLIC_ variable.

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_actual_key
EMAIL_FROM=accounts@mail.your-domain.com
AUTH_DEV_MAILER=0
AUTH_REQUIRE_EMAIL_VERIFICATION=1
APP_ORIGIN=http://127.0.0.1:3000
```

EMAIL_FROM must be a bare sender email address, without a display name. APP_ORIGIN must exactly match the browser address locally; production requires the public HTTPS origin. Public password endpoints also require AUTH_TRUSTED_IP_HEADER and the trusted ingress described in src/lib/auth/README.md.

5. Restart the app. Open Forgot password for an existing account whose email you control. For invoice delivery, confirm an invoice and click Send; its customer's stored email is the recipient. Demo addresses ending in `.test` are not real inboxes.

Without a verified domain, Resend's `onboarding@resend.dev` sender can be used only to send testing messages to the email address associated with your Resend account. See [sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). EMAIL_FROM=onboarding@resend.dev works for that limited setup. The app does not override recipients or automatically create accounts to bypass this restriction.

## What the application sends

- Password recovery: a single-use link to APP_ORIGIN/reset-password, expiring after 30 minutes. Only a SHA-256 token hash is stored. Real-mail responses never include devResetUrl, and the app never logs real reset links. The generic response is the same for unknown users and provider failures. Check server logs for the fixed delivery-failure message and Resend's dashboard for detailed delivery status; ask for a new link if none arrives.
- Email verification: a single-use, 60-minute link to /verify-email with the token in its URL fragment. New public accounts receive no session until verification and subsequent password login. Existing accounts retain their explicit legacy exemption, and synthetic seed accounts are demo exemptions rather than falsely marked verified.
- Invoice notices: invoice number, total, due date and a sign-in link to the customer's protected portal invoice. There is no public invoice attachment or bearer link. The recipient needs their customer login to open it. No automated billing-wide email blast is introduced.
- Invoice sentAt changes only after Resend accepts the message. Acceptance is not proof of inbox delivery: check Resend's dashboard for bounces or delivery events. Send again submits another notice; identical failed retries share an idempotency key to avoid duplicate submission within the provider's retention window.

The transport uses a fixed HTTPS endpoint, a 10-second timeout, no redirects/cache, and safe errors that exclude provider response bodies and secrets. HTML template text is escaped. Provider failures do not silently fall back to development logging. Temporary errors are durably queued; permanent immediate recovery failures invalidate the new link. The API's generic confirmation does not reveal which occurred.

## Automatic retries

Run `npm run mail:worker` in a second terminal alongside the app. It polls every ten seconds and resumes pending jobs after restart. `npm run mail:worker -- --once` processes a bounded batch; `npm run mail:worker -- --status` prints aggregate counts without private recipients or links. Invoice actions report accepted versus queued; sentAt updates only after provider acceptance. Jobs have an exponential backoff and a six-attempt maximum, bounded by link expiry or twelve hours for invoices.

Payloads are AES-256-GCM encrypted using a separate derived key from AUTH_SESSION_SECRET; they are removed after acceptance, expiration or final failure. A database lease coordinates competing workers; retries retain the original payload/sender/idempotency key. Superseded or consumed links and cancelled invoices are skipped. See docs/HARDENING.md for key rotation, retention and queue operation details.

## Local preview without an email account

```dotenv
EMAIL_PROVIDER=disabled
AUTH_DEV_MAILER=1
APP_ORIGIN=http://127.0.0.1:3000
```

Run `npm run dev -- --hostname 127.0.0.1 --port 3000`. Only development mode with a loopback origin permits console/on-screen reset links. This preview does not send invoice mail. When real Resend is selected, even incorrect credentials never enable the preview fallback.

## Verification and limitations

Automated tests stub fetch and exercise transport requests, timeouts/network failures, rejected/malformed provider responses, token hashing/expiry/single use, generic recovery failures, HTML escaping, invoice eligibility, sentAt semantics and retry/resend keys. They send no real emails. Live inbox delivery must be tested after account, sender and API-key configuration.

Email verification, durable logout revocation and the encrypted retry queue are implemented. Delivery webhooks and a bounce-suppression management UI are not included; use Resend's dashboard to inspect inbox-delivery events. Free quotas are shared by verification, recovery and invoice notices; batch billing does not automatically send them. The user chose to keep the test sender and excluded deployment/domain work.

Provider contract: [Send Email API](https://resend.com/docs/api-reference/emails/send-email), [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
