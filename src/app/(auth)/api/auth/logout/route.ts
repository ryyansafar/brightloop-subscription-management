import { authHandler, authJson } from "@/lib/auth/http";
import { revokeSessions, sessionCookie } from "@/lib/auth/session";

export const POST = authHandler(async (request) => {
  await revokeSessions(request);
  return authJson({ signedOut: true }, 200, sessionCookie("", true));
});
