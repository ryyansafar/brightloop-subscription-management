import { setTimeout } from "node:timers/promises";
import { db } from "../src/lib/db";
import { drainMailOutbox } from "../src/lib/mail-outbox";

const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => controller.abort());

async function main() {
  if (process.argv.includes("--status")) {
    const counts = await db.mailOutbox.groupBy({ by: ["status"], _count: { _all: true } });
    console.info(JSON.stringify(counts.map((row) => ({ status: row.status, count: row._count._all }))));
    return;
  }
  console.info("Mail retry worker started (message contents are never logged)");
  do {
    try { await drainMailOutbox(); } catch { console.error("Mail worker database operation failed; retrying later"); }
    if (process.argv.includes("--once")) break;
    try { await setTimeout(10_000, undefined, { signal: controller.signal }); } catch { break; }
  } while (!controller.signal.aborted);
}
main().catch(() => { console.error("Mail worker stopped unexpectedly"); process.exitCode = 1; }).finally(() => db.$disconnect());
