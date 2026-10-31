// Owner: fathima. Starter seed: one demo login per role. Extend with realistic data.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo@12345", 10);
  const users = [
    { email: "admin@brightloop.test", name: "Admin", role: "ADMIN" },
    { email: "staff@brightloop.test", name: "Staff", role: "STAFF" },
    { email: "customer@brightloop.test", name: "Demo Customer", role: "CUSTOMER" },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }
  const customerUser = await db.user.findUniqueOrThrow({
    where: { email: "customer@brightloop.test" },
  });
  await db.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: { userId: customerUser.id, name: customerUser.name, email: customerUser.email },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
