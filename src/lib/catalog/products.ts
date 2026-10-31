import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DomainError } from "../errors";
import { pageParams } from "../api";
import { activeFilter, guard } from "./guard";
import type { Resource } from "./resource";
import { productSchema, variantSchema } from "./schemas";

const include = { variants: { orderBy: { id: "asc" } } } satisfies Prisma.ProductInclude;
type ProductWithVariants = Prisma.ProductGetPayload<{ include: typeof include }>;

const productPatch = productSchema.omit({ variants: true }).partial();

function assertUniqueVariants(variants: { attribute: string; value: string }[] = []): void {
  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.attribute.toLowerCase()}::${v.value.toLowerCase()}`;
    if (seen.has(key)) throw new DomainError(`Duplicate variant ${v.attribute}: ${v.value}`, 409);
    seen.add(key);
  }
}

async function loadProduct(id: number): Promise<ProductWithVariants> {
  const product = await db.product.findUnique({ where: { id }, include });
  if (!product) throw new DomainError("Product not found", 404);
  return product;
}

export const productService: Resource<ProductWithVariants> = {
  async list(url) {
    const { page, take, skip } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();
    const type = url.searchParams.get("type");
    const where: Prisma.ProductWhereInput = {
      ...activeFilter(url),
      ...(q ? { name: { contains: q } } : {}),
      ...(type ? { type } : {}),
    };
    const [items, total] = await Promise.all([
      db.product.findMany({ where, include, orderBy: { id: "asc" }, take, skip }),
      db.product.count({ where }),
    ]);
    return { items, total, page, limit: take };
  },

  get: loadProduct,

  async create(input) {
    const data = productSchema.parse(input);
    assertUniqueVariants(data.variants);
    const { variants, ...fields } = data;
    return guard(
      () => db.product.create({ data: { ...fields, variants: { create: variants ?? [] } }, include }),
      "product",
    );
  },

  async update(id, input) {
    const patch = productPatch.parse(input);
    if (Object.keys(patch).length === 0) throw new DomainError("Nothing to update");
    await loadProduct(id);
    // Existing subscription lines keep the price they were created with.
    return guard(() => db.product.update({ where: { id }, data: patch, include }), "product");
  },

  async remove(id) {
    await loadProduct(id);
    await db.product.update({ where: { id }, data: { active: false } });
    return { id, active: false };
  },
};

export async function addVariant(productId: number, input: unknown) {
  const data = variantSchema.parse(input);
  await loadProduct(productId);
  return guard(() => db.variantOption.create({ data: { ...data, productId } }), "variant");
}

async function loadVariant(productId: number, variantId: number) {
  const variant = await db.variantOption.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw new DomainError("Variant not found", 404);
  return variant;
}

export async function updateVariant(productId: number, variantId: number, input: unknown) {
  const patch = variantSchema.partial().parse(input);
  if (Object.keys(patch).length === 0) throw new DomainError("Nothing to update");
  await loadVariant(productId, variantId);
  return guard(() => db.variantOption.update({ where: { id: variantId }, data: patch }), "variant");
}

/** A variant that subscriptions or templates already use can only be edited, not deleted. */
export async function removeVariant(productId: number, variantId: number) {
  await loadVariant(productId, variantId);
  const [lines, templateLines] = await Promise.all([
    db.subscriptionLine.count({ where: { variantOptionId: variantId } }),
    db.quoteTemplateLine.count({ where: { variantOptionId: variantId } }),
  ]);
  if (lines + templateLines > 0) {
    throw new DomainError("This variant is used by subscriptions or templates and cannot be deleted", 409);
  }
  await db.variantOption.delete({ where: { id: variantId } });
  return { id: variantId, deleted: true };
}
