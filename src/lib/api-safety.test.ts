import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fail, handle, intParam, ok, pageParams } from "./api";
import { GET as payments } from "@/app/api/payments/route";

afterEach(() => vi.restoreAllMocks());
const request = (query = "") => new Request(`http://localhost/api/payments${query}`, { headers: { "x-dev-role": "STAFF", "x-dev-user-id": "1" } });

describe("API boundaries", () => {
  it("prevents caches from retaining authenticated successes and errors", () => {
    expect(ok({}).headers.get("cache-control")).toBe("private, no-store");
    expect(fail("error").headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["NaN", "Infinity", "1.5", "-1", "0", "9007199254740992"])("rejects unsafe pagination %s", (value) => {
    expect(() => pageParams(new URL(`http://localhost/?page=${value}`))).toThrow(/Invalid page/);
    expect(() => pageParams(new URL(`http://localhost/?limit=${value}`))).toThrow(/Invalid limit/);
    expect(() => intParam(value)).toThrow(/Invalid/);
  });

  it("caps page arithmetic and preserves defaults", () => {
    expect(pageParams(new URL("http://localhost/"))).toEqual({ page: 1, take: 50, skip: 0 });
    expect(pageParams(new URL("http://localhost/?page=9007199254740991&limit=1000"))).toEqual({ page: 10_000, take: 100, skip: 999_900 });
    expect(() => intParam("2147483648")).toThrow(/Invalid/);
  });

  it("redacts exception objects and unknown validation keys", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const unexpected = handle(["STAFF"], async () => { throw new Error("private SQL and password"); });
    const response = await unexpected(request());
    expect(response.status).toBe(500);
    expect(log).toHaveBeenCalledWith("Unhandled API error", { name: "Error" });
    const invalid = handle(["STAFF"], async () => { z.object({}).strict().parse({ secretFieldName: true }); return ok({}); });
    expect(await (await invalid(request())).json()).toEqual({ ok: false, error: "Invalid request" });
  });

  it.each(["?from=garbage", "?to=2026-02-31", "?from=2026-12-01&to=2026-01-01", "?invoiceId=1.5"])("returns 400 for malformed payment filters %s", async (query) => {
    expect((await payments(request(query))).status).toBe(400);
  });
});
