// Page-level admin check, independent of the proxy and layout.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export async function requireAdminPage() {
  await connection();
  const cookie = (await cookies()).toString();
  const session = await getSessionUser(new Request("http://app.local", { headers: { cookie } }));
  if (!session) redirect("/login");
  if (session.role === "CUSTOMER") redirect("/portal");
  if (session.role !== "ADMIN") redirect("/dashboard");
  return session;
}
