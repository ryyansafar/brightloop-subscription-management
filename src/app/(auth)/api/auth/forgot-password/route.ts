import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { requestPasswordReset } from "@/lib/auth/password-reset";

export const POST = authHandler(async (request) => {
  const delivery = await requestPasswordReset(await authBody(request));
  return authJson({ message: "If an account exists, a reset link has been sent", ...delivery });
});
