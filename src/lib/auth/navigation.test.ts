import { describe, expect, it } from "vitest";
import { loginDestination } from "./navigation";

describe("post-login navigation", () => {
  it.each(["https://attacker.test", "//attacker.test", "/\\attacker.test", "/%2f%2fattacker.test", "/%5cattacker.test", "/login", "/api/auth/logout", "/signup?next=/login", "/invalid%", "/\nattacker"])(
    "rejects unsafe or authentication-loop destinations: %s", (next) => {
      expect(loginDestination(next, "ADMIN")).toBe("/dashboard");
    },
  );
  it("preserves valid filters on team pages", () => {
    expect(loginDestination("/subscriptions?status=ACTIVE", "STAFF")).toBe("/subscriptions?status=ACTIVE");
  });
  it("keeps customers in their portal and staff out of admin pages", () => {
    expect(loginDestination("/invoices/1", "CUSTOMER")).toBe("/portal");
    expect(loginDestination("/portal/invoices/1", "CUSTOMER")).toBe("/portal/invoices/1");
    expect(loginDestination("/admin/staff", "STAFF")).toBe("/dashboard");
    expect(loginDestination("/admin/staff", "ADMIN")).toBe("/admin/staff");
  });
});
