import { createAccount, publicUser } from "@/lib/auth/accounts";
import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { assertSessionConfigured, createSession, sessionCookie } from "@/lib/auth/session";
import { authSource, AuthError } from "@/lib/auth/security";
import { emailVerificationEnabled } from "@/lib/auth/config";
import { recoveryMailAvailable } from "@/lib/auth/recovery-mail";
import { requestEmailVerification } from "@/lib/auth/email-verification";

export const POST = authHandler(async (request) => {
  // Fail before creating an account when the server cannot issue a session.
  assertSessionConfigured();
  const verificationRequired = emailVerificationEnabled();
  if (verificationRequired && !recoveryMailAvailable()) throw new AuthError("Email verification delivery is not configured", 503);
  const user = await createAccount(await authBody(request), authSource(request));
  if (verificationRequired) {
    const delivery = await requestEmailVerification({ email: user.email }, authSource(request));
    return authJson({ ...publicUser(user), verificationRequired: true, ...delivery }, 201);
  }
  return authJson(publicUser(user), 201, sessionCookie(createSession(user)));
}, { limited: true });
