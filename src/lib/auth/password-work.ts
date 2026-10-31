import { createRequire } from "node:module";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { AuthError } from "./security";

/** Bound expensive bcrypt work and reject overload instead of creating an unbounded queue. */
export class PasswordWorkGate {
  private active = 0;
  constructor(private readonly concurrency = 2) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) throw new AuthError("Authentication is busy. Try again shortly", 503);
    this.active++;
    try { return await work(); }
    finally { this.active--; }
  }
}

const globalForPasswords = globalThis as typeof globalThis & { brightloopPasswordWork?: PasswordWorkGate };
const passwordWork = globalForPasswords.brightloopPasswordWork ??= new PasswordWorkGate();

// The source is constant. Passwords travel only in workerData, never in executable text.
// Loading the installed dependency at runtime keeps bcrypt's CPU work off the HTTP event loop.
const workerSource = `
  const { parentPort, workerData } = require("node:worker_threads");
  const bcrypt = require(workerData.modulePath);
  const result = workerData.operation === "hash"
    ? bcrypt.hashSync(workerData.password, 12)
    : bcrypt.compareSync(workerData.password, workerData.hash);
  parentPort.postMessage(result);
`;

function runPasswordWorker(operation: "hash", password: string): Promise<string>;
function runPasswordWorker(operation: "compare", password: string, hash: string): Promise<boolean>;
function runPasswordWorker(operation: "hash" | "compare", password: string, hash?: string) {
  return passwordWork.run(async () => {
    // next start runs from the project directory. Standalone deployments must include bcryptjs.
    const modulePath = createRequire(path.join(process.cwd(), "package.json")).resolve("bcryptjs");
    const worker = new Worker(workerSource, { eval: true, workerData: { modulePath, operation, password, hash } });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<string | boolean>((resolve, reject) => {
        worker.once("message", (value: unknown) => {
          if ((operation === "hash" && typeof value === "string") ||
              (operation === "compare" && typeof value === "boolean")) resolve(value);
          else reject(new Error("Invalid password worker result"));
        });
        worker.once("error", () => reject(new Error("Password worker failed")));
        worker.once("exit", () => reject(new Error("Password worker exited before returning a result")));
        timeout = setTimeout(() => reject(new AuthError("Authentication is busy. Try again shortly", 503)), 10_000);
      });
    } finally {
      if (timeout) clearTimeout(timeout);
      await worker.terminate();
    }
  });
}

export const hashPassword = (password: string) => runPasswordWorker("hash", password);
export const verifyPassword = (password: string, hash: string) => runPasswordWorker("compare", password, hash);
