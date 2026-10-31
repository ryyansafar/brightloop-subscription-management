import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

// Fresh SQLite file per run, built from the committed migrations.
export default function setup(): void {
  const dbFile = path.resolve(__dirname, "../../prisma/test.db");
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
