import type { Role } from "./state";

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
}

/**
 * The single seam between the API routes and authentication.
 *
 * Resolves the signed session cookie to a user (see src/lib/auth/README.md) and
 * checks the request origin on mutations. Header identities (`x-dev-role`,
 * `x-dev-user-id`) are honoured only under NODE_ENV=test with AUTH_DEV_BYPASS=1,
 * so a running server always ignores them.
 */
export async function resolveUser(request: Request): Promise<SessionUser | null> {
  const { assertSameOrigin } = await import("./auth/security");
  assertSameOrigin(request);
  // Existing API unit tests use header identities. Never trust them in a running app.
  if (process.env.NODE_ENV === "test" && process.env.AUTH_DEV_BYPASS === "1") {
    const role = request.headers.get("x-dev-role");
    const id = Number(request.headers.get("x-dev-user-id"));
    if ((role === "ADMIN" || role === "STAFF" || role === "CUSTOMER") && Number.isSafeInteger(id) && id > 0) {
      return { id, email: `dev-${id}@local.test`, role };
    }
  }
  const { getSessionUser } = await import("./auth/session");
  return getSessionUser(request);
}
