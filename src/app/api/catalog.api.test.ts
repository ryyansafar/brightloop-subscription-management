import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/test/factory";
import { GET as listDiscounts, POST as createDiscount } from "@/app/api/discounts/route";
import { GET as listProducts, POST as createProduct } from "@/app/api/products/route";
import { DELETE as deleteProduct, GET as getProduct, PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { POST as addVariantRoute } from "@/app/api/products/[id]/variants/route";
import { DELETE as deleteVariant } from "@/app/api/products/[id]/variants/[variantId]/route";
import { GET as listPlans } from "@/app/api/plans/route";
import { POST as createTax } from "@/app/api/taxes/route";

type Role = "ADMIN" | "STAFF" | "CUSTOMER";
interface ApiBody {
  ok: boolean;
  data?: { id?: number; items?: unknown[]; total?: number; active?: boolean; deleted?: boolean; variants?: { id: number }[] };
  error?: string;
}

function call(url: string, role?: Role, body?: unknown, method?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (role) {
    headers["x-dev-role"] = role;
    headers["x-dev-user-id"] = "1";
  }
  return new Request(`http://localhost${url}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = <P extends Record<string, string>>(params: P) => ({ params: Promise.resolve(params) });
const json = async (res: Response) => (await res.json()) as ApiBody;

const product = { name: "Brightloop CRM", type: "SOFTWARE", salesPrice: 240_000 };

beforeEach(resetDb);

describe("catalog API access", () => {
  it("requires sign-in", async () => {
    expect((await listProducts(call("/api/products"))).status).toBe(401);
  });

  it("lets staff read the catalog but not change it", async () => {
    expect((await listProducts(call("/api/products", "STAFF"))).status).toBe(200);
    expect((await listPlans(call("/api/plans", "STAFF"))).status).toBe(200);
    expect((await createProduct(call("/api/products", "STAFF", product))).status).toBe(403);
    expect((await createTax(call("/api/taxes", "STAFF", { name: "GST", rateBps: 1800 }))).status).toBe(403);
    expect((await createDiscount(call("/api/discounts", "STAFF", {}))).status).toBe(403);
  });

  it("keeps customers out of the catalog entirely", async () => {
    expect((await listProducts(call("/api/products", "CUSTOMER"))).status).toBe(403);
    expect((await listDiscounts(call("/api/discounts", "CUSTOMER"))).status).toBe(403);
  });
});

describe("catalog API behaviour (admin)", () => {
  it("creates, reads, edits and retires a product", async () => {
    const created = await createProduct(call("/api/products", "ADMIN", product));
    expect(created.status).toBe(201);
    const { id } = (await json(created)).data!;

    const read = await json(await getProduct(call(`/api/products/${id}`, "STAFF"), ctx({ id: String(id) })));
    expect(read.ok).toBe(true);

    const patched = await patchProduct(call(`/api/products/${id}`, "ADMIN", { salesPrice: 250_000 }, "PATCH"), ctx({ id: String(id) }));
    expect(patched.status).toBe(200);

    const retired = await json(await deleteProduct(call(`/api/products/${id}`, "ADMIN", undefined, "DELETE"), ctx({ id: String(id) })));
    expect(retired.data?.active).toBe(false);
    const activeOnly = await json(await listProducts(call("/api/products?active=1", "ADMIN")));
    expect(activeOnly.data?.total).toBe(0);
  });

  it("returns clear errors for bad input, bad ids and missing rows", async () => {
    const bad = await createProduct(call("/api/products", "ADMIN", { ...product, salesPrice: -5 }));
    const body = await json(bad);
    expect(bad.status).toBe(400);
    expect(body.error).toMatch(/Sales price/);

    const noBody = await patchProduct(call("/api/products/1", "ADMIN", {}, "PATCH"), ctx({ id: "1" }));
    expect(noBody.status).toBe(404); // product 1 does not exist

    expect((await getProduct(call("/api/products/abc", "ADMIN"), ctx({ id: "abc" }))).status).toBe(400);
    expect((await getProduct(call("/api/products/999", "ADMIN"), ctx({ id: "999" }))).status).toBe(404);
  });

  it("adds and removes variants through nested routes", async () => {
    const created = await json(await createProduct(call("/api/products", "ADMIN", product)));
    const id = created.data!.id!;
    const added = await addVariantRoute(
      call(`/api/products/${id}/variants`, "ADMIN", { attribute: "Brand", value: "Odoo", extraPrice: 56_000 }),
      ctx({ id: String(id) }),
    );
    expect(added.status).toBe(201);
    const dup = await addVariantRoute(
      call(`/api/products/${id}/variants`, "ADMIN", { attribute: "Brand", value: "Odoo" }),
      ctx({ id: String(id) }),
    );
    expect(dup.status).toBe(409);

    const variantId = (await json(added)).data!.id!;
    const removed = await deleteVariant(
      call(`/api/products/${id}/variants/${variantId}`, "ADMIN", undefined, "DELETE"),
      ctx({ id: String(id), variantId: String(variantId) }),
    );
    expect((await json(removed)).data?.deleted).toBe(true);
  });
});
