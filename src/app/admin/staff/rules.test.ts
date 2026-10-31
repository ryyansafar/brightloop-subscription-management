import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/factory";
import { listStaffUsers } from "./queries";
import { mapApiError, passwordRules, validateStaff } from "./rules";

describe("passwordRules", () => {
  it("keeps the agreed order and wording", () => {
    expect(passwordRules("").map((r) => r.label)).toEqual([
      "More than 8 characters",
      "An uppercase letter",
      "A lowercase letter",
      "A special character",
    ]);
  });
  it("needs nine characters, not eight", () => {
    expect(passwordRules("Abcdef1!")[0].met).toBe(false);
    expect(passwordRules("Abcdefg1!")[0].met).toBe(true);
  });
  it("tracks each rule independently", () => {
    expect(passwordRules("abcdefghij").map((r) => r.met)).toEqual([true, false, true, false]);
    expect(passwordRules("ABCDEFGHIJ!").map((r) => r.met)).toEqual([true, true, false, true]);
  });
});

describe("validateStaff", () => {
  it("flags every bad field", () => {
    const errors = validateStaff({ name: " ", email: "nope", password: "weak" });
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "password"]);
  });
  it("accepts a valid member", () => {
    expect(validateStaff({ name: "Ishita Verma", email: "ishita@brightloop.test", password: "Strong#Pass1" })).toEqual({});
  });
  it("rejects passwords over 72 bytes", () => {
    expect(validateStaff({ name: "A", email: "a@b.co", password: `Aa!${"x".repeat(80)}` }).password).toMatch(/72/);
  });
});

describe("mapApiError", () => {
  it("maps field messages", () => {
    expect(mapApiError("email: Enter a valid email address; password: Password must contain a special character")).toEqual({
      email: "Enter a valid email address",
      password: "Password must contain a special character",
    });
  });
  it("maps duplicate emails and unknown errors", () => {
    expect(mapApiError("An account with this email already exists").email).toMatch(/already exists/);
    expect(mapApiError("Something went wrong")).toEqual({ form: "Something went wrong" });
  });
});

describe("listStaffUsers authorization", () => {
  beforeEach(resetDb);
  it("refuses non-admin callers", async () => {
    await expect(listStaffUsers("STAFF")).rejects.toThrow();
    await expect(listStaffUsers("CUSTOMER")).rejects.toThrow();
  });
  it("lists admins and staff but never customers", async () => {
    await db.user.createMany({
      data: [
        { name: "A", email: "a@t.dev", passwordHash: "x", role: "ADMIN" },
        { name: "S", email: "s@t.dev", passwordHash: "x", role: "STAFF" },
        { name: "C", email: "c@t.dev", passwordHash: "x", role: "CUSTOMER" },
      ],
    });
    const rows = await listStaffUsers("ADMIN");
    expect(rows.map((r) => r.email).sort()).toEqual(["a@t.dev", "s@t.dev"]);
  });
});
