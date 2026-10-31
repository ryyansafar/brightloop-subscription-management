import { authHandler, authJson } from "@/lib/auth/http";
import { sessionCookie } from "@/lib/auth/session";

export const POST = authHandler(async () => authJson({ signedOut: true }, 200, sessionCookie("", true)));
