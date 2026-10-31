import { describe, expect, it } from "vitest";
import { checkPassword, passwordProblem, strengthOf } from "./password-rules";

describe("checkPassword", () => {
  it("lists the rules in the agreed order and wording", () => {
    expect(checkPassword("").rules.map((r) => r.label)).toEqual([
      "More than 8 characters",
      "An uppercase letter",
      "A lowercase letter",
      "A special character",
    ]);
  });

  it("requires strictly more than 8 characters", () => {
    expect(checkPassword("Abcdef!1").rules[0].met).toBe(false);
    expect(checkPassword("Abcdefg!1").rules[0].met).toBe(true);
  });

  it("marks each rule independently", () => {
    const r = checkPassword("alllowercase");
    expect(r.rules.map((x) => x.met)).toEqual([true, false, true, false]);
    expect(r.metCount).toBe(2);
    expect(r.valid).toBe(false);
  });

  it("accepts a strong password and rejects one over 72 bytes", () => {
    expect(checkPassword("Demo@12345").valid).toBe(true);
    expect(checkPassword(`Aa!${"x".repeat(80)}`).valid).toBe(false);
  });

  it("does not treat spaces or digits as special characters", () => {
    expect(checkPassword("Abcdefgh 1").rules[3].met).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("names the first missing rule", () => {
    expect(passwordProblem("")).toBe("Enter a password.");
    expect(passwordProblem("abcdefghij")).toBe("Password needs: an uppercase letter.");
    expect(passwordProblem("Demo@12345")).toBeNull();
  });
});

describe("strengthOf", () => {
  it("maps rules met to a label", () => {
    expect([0, 1, 2, 3, 4].map(strengthOf)).toEqual(["none", "weak", "fair", "good", "strong"]);
  });
});
