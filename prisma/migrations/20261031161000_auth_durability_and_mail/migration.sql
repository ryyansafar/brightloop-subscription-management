ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT true;
-- Existing accounts retain access; this is an explicit legacy exemption, not proof of email ownership.
UPDATE "User" SET "emailVerificationRequired" = false;
-- A successfully consumed recovery link already proves control of that mailbox.
UPDATE "User" SET "emailVerifiedAt" = (SELECT MAX("usedAt") FROM "PasswordReset" WHERE "PasswordReset"."userId" = "User"."id" AND "usedAt" IS NOT NULL)
WHERE EXISTS (SELECT 1 FROM "PasswordReset" WHERE "PasswordReset"."userId" = "User"."id" AND "usedAt" IS NOT NULL);

CREATE TABLE "EmailVerification" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

CREATE TABLE "AuthRateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "resetAtMs" BIGINT NOT NULL
);
CREATE INDEX "AuthRateLimit_resetAtMs_idx" ON "AuthRateLimit"("resetAtMs");

CREATE TABLE "MailOutbox" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "referenceId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" DATETIME,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" DATETIME,
  "lastError" TEXT
);
CREATE UNIQUE INDEX "MailOutbox_idempotencyKey_key" ON "MailOutbox"("idempotencyKey");
CREATE INDEX "MailOutbox_status_nextAttemptAt_idx" ON "MailOutbox"("status", "nextAttemptAt");
CREATE INDEX "MailOutbox_expiresAt_idx" ON "MailOutbox"("expiresAt");
