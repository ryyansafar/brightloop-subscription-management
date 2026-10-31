import { authBody, authHandler, authJson } from "@/lib/auth/http";
import { verifyEmail } from "@/lib/auth/email-verification";

export const POST = authHandler(async (request) => {
  await verifyEmail(await authBody(request));
  return authJson({ message: "Your email is verified. You can now sign in." });
}, { limited: true });
