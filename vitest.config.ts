import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    env: { DATABASE_URL: "file:./test.db", AUTH_DEV_BYPASS: "1", AUTH_REQUIRE_EMAIL_VERIFICATION: "0", EMAIL_PROVIDER: "disabled", AUTH_SESSION_SECRET: "test-only-signing-and-outbox-secret-32-characters" },
    fileParallelism: false,
  },
});
