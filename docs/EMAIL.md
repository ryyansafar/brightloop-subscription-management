# Transactional email with Resend

Brightloop can send password-reset links and invoice notices through Resend's HTTPS API. No SDK, migration or additional package is required. Mail is disabled by default, and API keys remain server-side.

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
APP_ORIGIN=http://127.0.0.1:3000
```

EMAIL_FROM must be a bare sender email address, without a display name. APP_ORIGIN must exactly match the browser address locally; production requires the public HTTPS origin. Public password endpoints also require AUTH_TRUSTED_IP_HEADER and the trusted ingress described in src/lib/auth/README.md.

5. Restart the app. Open Forgot password for an existing account whose email you control. For invoice delivery, confirm an invoice and click Send; its customer's stored email is the recipient. Demo addresses ending in `.test` are not real inboxes.

Without a verified domain, Resend's `onboarding@resend.dev` sender can be used only to send testing messages to the email address associated with your Resend account. See [sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). EMAIL_FROM=onboarding@resend.dev works for that limited setup. The app does not override recipients or automatically create accounts to bypass this restriction.

## What the application sends

- Password recovery: a single-use link to APP_ORIGIN/reset-password, expiring after 30 minutes. Only a SHA-256 token hash is stored. Real-mail responses never include devResetUrl, and the app never logs real reset links. The generic response is the same for unknown users and provider failures. Check server logs for the fixed delivery-failure message and Resend's dashboard for detailed delivery status; ask for a new link if none arrives.
- Invoice notices: invoice number, total, due date and a sign-in link to the customer's protected portal invoice. There is no public invoice attachment or bearer link. The recipient needs their customer login to open it. No automated billing-wide email blast is introduced.
- Invoice sentAt changes only after Resend accepts the message. Acceptance is not proof of inbox delivery: check Resend's dashboard for bounces or delivery events. Send again submits another notice; identical failed retries share an idempotency key to avoid duplicate submission within the provider's retention window.

The transport uses a fixed HTTPS endpoint, a 10-second timeout, no redirects/cache, and safe errors that exclude provider response bodies and secrets. HTML template text is escaped. Provider failures do not silently fall back to development logging. An ambiguously timed-out reset message is invalidated; its late-arriving link will not work, so request a fresh one.

## Local preview without an email account

```dotenv
EMAIL_PROVIDER=disabled
AUTH_DEV_MAILER=1
APP_ORIGIN=http://127.0.0.1:3000
```

Run `npm run dev -- --hostname 127.0.0.1 --port 3000`. Only development mode with a loopback origin permits console/on-screen reset links. This preview does not send invoice mail. When real Resend is selected, even incorrect credentials never enable the preview fallback.

## Verification and limitations

Automated tests stub fetch and exercise transport requests, timeouts/network failures, rejected/malformed provider responses, token hashing/expiry/single use, generic recovery failures, HTML escaping, invoice eligibility, sentAt semantics and retry/resend keys. They send no real emails. Live inbox delivery must be tested after account, sender and API-key configuration.

No durable mail outbox, automatic retry queue, delivery webhook or bounce suppression workflow is implemented. Use the provider dashboard to inspect delivery. Email verification and durable session revocation remain separate work. Free quotas are shared by recovery and invoice notices; batch billing does not automatically send them.

Provider contract: [Send Email API](https://resend.com/docs/api-reference/emails/send-email), [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
