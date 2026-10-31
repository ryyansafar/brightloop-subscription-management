import { describe, expect, it } from "vitest";
import { destinationFor, safeNext } from "./safe-redirect";

describe("safeNext", () => {
  it("accepts internal paths with query strings", () => {
    expect(safeNext("/invoices?page=2")).toBe("/invoices?page=2");
    expect(safeNext("/portal/invoices/4")).toBe("/portal/invoices/4");
  });

  it.each([
    "https://evil.test/x",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "invoices",
    "/a\r\nb",
    "/a\\b",
    "",
    "/login",
    "/reset-password?token=x",
  ])("rejects %j", (value) => {
    expect(safeNext(value)).toBeNull();
  });

  it("handles null and undefined", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
  });
});

describe("destinationFor", () => {
  it("sends staff and admins to the dashboard by default", () => {
    expect(destinationFor("ADMIN", null)).toBe("/dashboard");
    expect(destinationFor("STAFF", "//evil.test")).toBe("/dashboard");
  });

  it("honours a safe next for staff", () => {
    expect(destinationFor("STAFF", "/invoices/3")).toBe("/invoices/3");
  });

  it("keeps customers inside the portal", () => {
    expect(destinationFor("CUSTOMER", null)).toBe("/portal");
    expect(destinationFor("CUSTOMER", "/dashboard")).toBe("/portal");
    expect(destinationFor("CUSTOMER", "/portal/invoices")).toBe("/portal/invoices");
    expect(destinationFor("CUSTOMER", "/portalx")).toBe("/portal");
  });
});
