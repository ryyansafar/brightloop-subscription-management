import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { resetPassword } from "@/lib/auth/password-reset";
import { sessionCookie } from "@/lib/auth/session";

export const POST = authHandler(async (request) => {
  await resetPassword(await authBody(request));
  return authJson({ message: "Password updated. Sign in with your new password" }, 200, sessionCookie("", true));
});
