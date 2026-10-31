import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fakerEN_IN as faker } from "@faker-js/faker";

export const DEMO_PASSWORD = "Demo@12345";

export const DEMO_LOGINS = [
  { email: "admin@brightloop.test", name: "Admin", role: "ADMIN" },
  { email: "staff@brightloop.test", name: "Priya Nair (Staff)", role: "STAFF" },
  { email: "staff2@brightloop.test", name: "Arjun Menon (Staff)", role: "STAFF" },
  { email: "customer@brightloop.test", name: "Northwind Retail (Demo)", role: "CUSTOMER" },
] as const;

/** Demo users (one per role) plus `count` customers; customer 1 is the demo customer. */
export async function seedPeople(db: PrismaClient, count: number): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db.user.createMany({
    data: DEMO_LOGINS.map((u) => ({ ...u, passwordHash })),
  });
  const demoUser = await db.user.findUniqueOrThrow({ where: { email: "customer@brightloop.test" } });

  const customers = Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    const company = id === 1 ? "Northwind Retail (Demo)" : faker.company.name();
    return {
      id,
      userId: id === 1 ? demoUser.id : null,
      name: company,
      email: id === 1 ? demoUser.email : `billing${id}@customer.example`,
      phone: faker.phone.number(),
      company,
      address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
    };
  });
  for (let i = 0; i < customers.length; i += 500) {
    await db.customer.createMany({ data: customers.slice(i, i + 500) });
  }
}
