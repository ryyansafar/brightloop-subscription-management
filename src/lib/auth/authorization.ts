import type { Role } from "@/lib/state";
import { getSessionUser } from "./session";
import { AuthError } from "./security";

export async function requireRole(request: Request, roles: readonly Role[]) {
  const user = await getSessionUser(request);
  if (!user) throw new AuthError("You are not signed in", 401);
  if (!roles.includes(user.role)) throw new AuthError("You do not have access to this", 403);
  return user;
}
