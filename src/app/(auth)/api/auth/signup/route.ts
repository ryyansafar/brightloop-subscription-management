import { createAccount, publicUser } from "@/lib/auth/accounts";
import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { assertSessionConfigured, createSession, sessionCookie } from "@/lib/auth/session";
import { authSource } from "@/lib/auth/security";

export const POST = authHandler(async (request) => {
  // Fail before creating an account when the server cannot issue a session.
  assertSessionConfigured();
  const user = await createAccount(await authBody(request), authSource(request));
  return authJson(publicUser(user), 201, sessionCookie(createSession(user)));
}, { limited: true });
