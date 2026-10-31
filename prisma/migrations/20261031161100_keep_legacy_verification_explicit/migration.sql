-- Historical PasswordReset.usedAt also includes superseded/undelivered tokens;
-- it cannot establish mailbox ownership. Keep legacy access exemptions explicit
-- without claiming that any pre-migration email was verified.
UPDATE "User" SET "emailVerifiedAt" = NULL
WHERE "emailVerificationRequired" = false;
