# 31 October — pankaj: Resend test sender configuration

## Changed
- Pulled through 85bce65 and read the latest audit/payment-label handoffs.
- User selected Resend's account-email-only testing mode. Local ignored .env now selects EMAIL_PROVIDER=resend, EMAIL_FROM=onboarding@resend.dev and AUTH_DEV_MAILER=0. Existing credentials were preserved; the local API key is currently absent/empty and must be filled by the user.
- .env.example now documents the test sender and its recipient restriction, retaining disabled-by-default mail and an empty API-key placeholder. No real credential or recipient address is committed.

## Needs action from others
- @pankaj/user: add your actual RESEND_API_KEY privately and restart the server. Recovery requires a Brightloop user with your Resend account email; invoice testing requires that same address as the invoice customer's email. Live sending has not been claimed or verified without credentials.
- @ryyan @fathima: the email-provider decision is now Resend test mode, not a verified sending domain. Sending to arbitrary seeded/customer addresses remains unavailable. Other audit findings (portal payment labels/production not-found behavior) remain separate from this configuration-only task.

## Breaking / contract changes
- None in application code. Template still defaults to EMAIL_PROVIDER=disabled until explicitly configured.
