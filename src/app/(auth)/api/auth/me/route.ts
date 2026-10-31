import { requireRole } from "@/lib/auth/authorization";
import { authHandler, authJson } from "@/lib/auth/http";
import { ROLES } from "@/lib/state";

export const GET = authHandler(async (request) => authJson(await requireRole(request, ROLES)));
