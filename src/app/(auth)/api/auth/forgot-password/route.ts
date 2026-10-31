import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { authSource } from "@/lib/auth/security";

export const POST = authHandler(async (request) => {
  const delivery = await requestPasswordReset(await authBody(request), authSource(request));
  return authJson({ message: "If an account exists, a reset link has been sent", ...delivery });
}, { limited: true });
