import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { authSource } from "@/lib/auth/security";

export const POST = authHandler(async (request) => {
  const delivery = await requestPasswordReset(await authBody(request), authSource(request));
  return authJson({ message: "If an account exists, you’ll receive a reset link. If it doesn’t arrive, try again later or contact support.", ...delivery });
}, { limited: true });
