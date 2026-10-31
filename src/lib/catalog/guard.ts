import { Prisma } from "@prisma/client";
import { DomainError } from "../errors";

/** Turn database constraint failures into readable, user-facing errors. */
export async function guard<T>(work: () => Promise<T>, what = "record"): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") throw new DomainError(`That ${what} already exists`, 409);
      if (error.code === "P2025") throw new DomainError(`${what[0].toUpperCase()}${what.slice(1)} not found`, 404);
      if (error.code === "P2003") {
        throw new DomainError(`That ${what} is in use or refers to something that does not exist`, 409);
      }
    }
    throw error;
  }
}

/** Common list filter: `?active=1|0`, default shows everything. */
export function activeFilter(url: URL): { active?: boolean } {
  const value = url.searchParams.get("active");
  return value === "1" ? { active: true } : value === "0" ? { active: false } : {};
}
