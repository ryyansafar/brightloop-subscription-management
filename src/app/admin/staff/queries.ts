// Reads for the staff users page. The role check lives here too, so the data cannot be read by calling
// this function from another page without proving the caller is an admin.
import { db } from "@/lib/db";
import type { Role } from "@/lib/state";

export async function listStaffUsers(actorRole: Role) {
  if (actorRole !== "ADMIN") throw new Error("Only admins can list staff users");
  return db.user.findMany({
    where: { role: { in: ["ADMIN", "STAFF"] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 200,
  });
}

export type StaffRow = Awaited<ReturnType<typeof listStaffUsers>>[number];
