import { describe, expect, it } from "vitest";
import { isEmail } from "./form";

describe("isEmail", () => {
  it("accepts ordinary addresses and trims", () => {
    expect(isEmail("a@b.co")).toBe(true);
    expect(isEmail("  admin@brightloop.test ")).toBe(true);
  });
  it.each(["", "abc", "a@b", "a b@c.com", "@c.com", "a@.com"])("rejects %j", (v) => {
    expect(isEmail(v)).toBe(false);
  });
});
