// Resolves who is looking at a portal page. Independent of the proxy and layout: it re-checks the signed
// session itself and only ever yields the customer record linked to that user.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type PortalScope =
  | { linked: true; customerId: number; displayName: string; today: Date }
  | { linked: false; displayName: string; today: Date };

export async function getPortalScope(): Promise<PortalScope> {
  await connection(); // reads the session and the clock: per request, never prerendered
  const cookie = (await cookies()).toString();
  const session = await getSessionUser(new Request("http://app.local", { headers: { cookie } }));
  if (!session) redirect("/login");
  if (session.role !== "CUSTOMER") redirect("/dashboard"); // staff and admins use the back office
  const today = new Date();
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { name: true, customer: { select: { id: true, name: true, company: true } } },
  });
  if (!user.customer) return { linked: false, displayName: user.name, today };
  const { id, name, company } = user.customer;
  return { linked: true, customerId: id, displayName: company?.trim() || name, today };
}
