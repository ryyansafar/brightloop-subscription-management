import type { Role } from "./state";

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
}

/**
 * The single seam between the API routes and authentication.
 *
 * pankaj: replace the body with the real session lookup (cookie -> user). Keep the
 * signature; every route in src/app/api already calls this through `handle()`.
 *
 * Until then, set AUTH_DEV_BYPASS=1 in .env and send `x-dev-user-id` and
 * `x-dev-role` headers to call the API locally. Never enable it for the demo.
 */
export async function resolveUser(request: Request): Promise<SessionUser | null> {
  if (process.env.AUTH_DEV_BYPASS === "1") {
    const role = request.headers.get("x-dev-role");
    const id = Number(request.headers.get("x-dev-user-id"));
    if ((role === "ADMIN" || role === "STAFF" || role === "CUSTOMER") && Number.isInteger(id)) {
      return { id, email: `dev-${id}@local.test`, role };
    }
  }
  return null;
}
