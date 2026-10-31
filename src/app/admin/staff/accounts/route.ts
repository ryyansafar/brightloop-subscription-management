import { requireRole } from "@/lib/auth/authorization";
import { createAccount, publicUser } from "@/lib/auth/accounts";
import { authBody, authHandler, authJson } from "@/lib/auth/http";

export const POST = authHandler(async (request) => {
  await requireRole(request, ["ADMIN"]);
  const user = await createAccount(await authBody(request), "STAFF");
  return authJson(publicUser(user), 201);
});
