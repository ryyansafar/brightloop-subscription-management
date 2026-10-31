import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api";

const MAX_LIMIT = 50;

/** Read-only customer search for pickers. Staff and admins only. */
export const GET = handle(["ADMIN", "STAFF"], async ({ request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const requested = Number(url.searchParams.get("limit"));
  const take = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : 10;

  const where = q
    ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { company: { contains: q } }] }
    : {};
  const items = await db.customer.findMany({
    where,
    select: { id: true, name: true, email: true, company: true },
    orderBy: { name: "asc" },
    take,
  });
  return ok({ items });
});
