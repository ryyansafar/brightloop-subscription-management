import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { requestEmailVerification } from "@/lib/auth/email-verification";
import { authSource } from "@/lib/auth/security";

export const POST = authHandler(async (request) => {
  const delivery = await requestEmailVerification(await authBody(request), authSource(request));
  return authJson({ message: "If the account needs verification, you’ll receive a link. If it doesn’t arrive, try again later or contact support.", ...delivery });
}, { limited: true });
