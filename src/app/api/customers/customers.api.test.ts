import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/factory";
import { GET } from "./route";

function req(url: string, role?: string): Request {
  const headers: Record<string, string> = {};
  if (role) {
    headers["x-dev-role"] = role;
    headers["x-dev-user-id"] = "1";
  }
  return new Request(`http://localhost${url}`, { headers });
}

interface Body {
  ok: boolean;
  data?: { items: { id: number; name: string }[] };
  error?: string;
}

describe("GET /api/customers", () => {
  beforeAll(async () => {
    await resetDb();
    await db.customer.createMany({
      data: [
        { name: "Kaveri Textiles", email: "k@test.dev" },
        { name: "Bluewave Fitness", email: "b@test.dev", company: "Bluewave" },
        { name: "Orbit Cargo", email: "o@test.dev" },
      ],
    });
  });

  it("rejects anonymous and customer callers", async () => {
    expect((await GET(req("/api/customers"))).status).toBe(401);
    expect((await GET(req("/api/customers", "CUSTOMER"))).status).toBe(403);
  });

  it("lists customers sorted by name for staff", async () => {
    const body = (await (await GET(req("/api/customers", "STAFF"))).json()) as Body;
    expect(body.data?.items.map((c) => c.name)).toEqual(["Bluewave Fitness", "Kaveri Textiles", "Orbit Cargo"]);
  });

  it("searches by name and respects the limit", async () => {
    const found = (await (await GET(req("/api/customers?q=cargo", "ADMIN"))).json()) as Body;
    expect(found.data?.items).toHaveLength(1);
    const limited = (await (await GET(req("/api/customers?limit=2", "ADMIN"))).json()) as Body;
    expect(limited.data?.items).toHaveLength(2);
  });
});
