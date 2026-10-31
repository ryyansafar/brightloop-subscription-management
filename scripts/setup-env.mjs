// Creates .env from .env.example and fills in a random AUTH_SESSION_SECRET. Works on macOS, Linux and Windows.
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync(".env")) copyFileSync(".env.example", ".env");

let env = readFileSync(".env", "utf8");
const hasSecret = /^AUTH_SESSION_SECRET=.{32,}$/m.test(env);
if (!hasSecret) {
  const line = `AUTH_SESSION_SECRET=${randomBytes(32).toString("hex")}`;
  env = /^AUTH_SESSION_SECRET=.*$/m.test(env)
    ? env.replace(/^AUTH_SESSION_SECRET=.*$/m, line)
    : `${env.trimEnd()}\n${line}\n`;
}
if (!/^APP_ORIGIN=/m.test(env)) env = `${env.trimEnd()}\nAPP_ORIGIN=http://localhost:3000\n`;
writeFileSync(".env", env);
process.stdout.write(".env is ready (session secret generated locally, never committed)\n");
