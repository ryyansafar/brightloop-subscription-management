import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { authBody, authHandler, MAX_AUTH_BODY_BYTES } from "./http";

afterEach(() => vi.restoreAllMocks());

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body,
  });
}

describe("auth HTTP boundary", () => {
  it("rejects oversized bodies by declared length and actual bytes", async () => {
    await expect(authBody(request("{}", { "content-length": String(MAX_AUTH_BODY_BYTES + 1) }))).rejects.toMatchObject({ status: 413 });
    await expect(authBody(request(JSON.stringify({ name: "é".repeat(MAX_AUTH_BODY_BYTES) })))).rejects.toMatchObject({ status: 413 });
  });

  it("caps streamed bodies even without Content-Length", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) { controller.enqueue(new Uint8Array(4096)); },
      cancel() { cancelled = true; },
    });
    const streamed = new Request("http://localhost/api/auth/signup", {
      method: "POST", headers: { "content-type": "application/json" }, body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(authBody(streamed)).rejects.toMatchObject({ status: 413 });
    expect(cancelled).toBe(true);
  });

  it("requires JSON content type and rejects malformed JSON", async () => {
    await expect(authBody(request("{}", { "content-type": "text/plain" }))).rejects.toMatchObject({ status: 415 });
    await expect(authBody(request("{"))).rejects.toMatchObject({ status: 400 });
    await expect(authBody(request('{"name":"é"}', { "content-type": "application/json; charset=utf-8" }))).resolves.toEqual({ name: "é" });
  });

  it("does not echo unknown field names in validation errors", async () => {
    const handler = authHandler(async () => {
      z.object({}).strict().parse({ sensitiveUnknownField: "value" });
      return Response.json({});
    });
    const response = await handler(request("{}"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "Invalid request" });
  });

  it("logs safe error metadata without error messages, SQL or credentials", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("password=secret SQL WHERE email=private"), { code: "P2024" });
    const handler = authHandler(async () => { throw error; });
    const response = await handler(request("{}"));
    expect(response.status).toBe(500);
    expect(logger).toHaveBeenCalledWith("Unhandled authentication error", { name: "Error", code: "P2024" });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("secret");
  });
});
