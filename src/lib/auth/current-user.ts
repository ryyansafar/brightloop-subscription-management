import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/lib/db";
import type { Role } from "@/lib/state";
import { getSessionUser } from "./session";

/** Request-scoped identity for server-rendered pages; never cache sessions across requests. */
export const getCurrentUser = cache(async () => {
  await connection();
  const cookie = (await cookies()).toString();
  const session = await getSessionUser(new Request("http://session.local", { headers: { cookie } }));
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { name: true } });
  return user ? { ...session, name: user.name } : null;
});

export async function requirePageRole(roles: readonly Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(user.role === "CUSTOMER" ? "/portal" : "/dashboard");
  return user;
}
