import { authenticate, publicUser } from "@/lib/auth/accounts";
import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { createSession, sessionCookie } from "@/lib/auth/session";
import { authSource } from "@/lib/auth/security";

export const POST = authHandler(async (request) => {
  const user = await authenticate(await authBody(request), authSource(request));
  return authJson(publicUser(user), 200, sessionCookie(createSession(user)));
}, { limited: true });
