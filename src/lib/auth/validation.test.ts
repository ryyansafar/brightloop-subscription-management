import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema, signupSchema } from "./validation";

describe("password policy", () => {
  it.each([
    ["Short@Aa", "longer than 8"],
    ["lowercase@123", "uppercase"],
    ["UPPERCASE@123", "lowercase"],
    ["NoSpecial123", "special"],
    ["White Space123", "special"],
    ["Ab!" + "x".repeat(70), "72 UTF-8 bytes"],
    ["Ab!" + "é".repeat(35), "72 UTF-8 bytes"],
  ])("rejects %s", (password, message) => {
    const result = passwordSchema.safeParse(password);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain(message);
  });

  it.each(["Valid@123", "Ab!" + "x".repeat(69), "LettersOnly!", "UnicodeéAb!123"])("accepts %s", (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(true);
  });

  it("normalizes identity but preserves the password", () => {
    expect(signupSchema.parse({ name: "  Customer  ", email: " NAME@Example.COM ", password: " Valid@123 " }))
      .toEqual({ name: "Customer", email: "name@example.com", password: " Valid@123 " });
  });

  it("rejects client-supplied roles", () => {
    expect(signupSchema.safeParse({ name: "A", email: "a@test.dev", password: "Valid@123", role: "ADMIN" }).success).toBe(false);
  });

  it("rejects login passwords that bcrypt would silently truncate", () => {
    expect(loginSchema.safeParse({ email: "a@test.dev", password: "Ab!" + "x".repeat(70) }).success).toBe(false);
  });
});
