import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { DomainError } from "../errors";
import { pageParams } from "../api";
import { guard } from "./guard";
import type { Resource } from "./resource";
import { templateSchema } from "./schemas";

const include = {
  plan: { select: { id: true, name: true } },
  lines: { orderBy: { id: "asc" } },
} satisfies Prisma.QuoteTemplateInclude;
type TemplateView = Prisma.QuoteTemplateGetPayload<{ include: typeof include }>;

const templatePatch = templateSchema.partial();

async function loadTemplate(id: number): Promise<TemplateView> {
  const template = await db.quoteTemplate.findUnique({ where: { id }, include });
  if (!template) throw new DomainError("Quotation template not found", 404);
  return template;
}

async function assertRefs(
  planId: number | undefined,
  lines: { productId: number; variantOptionId?: number | null }[] | undefined,
): Promise<void> {
  if (planId !== undefined) {
    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) throw new DomainError("Plan not found or inactive", 404);
  }
  for (const line of lines ?? []) {
    const product = await db.product.findUnique({ where: { id: line.productId } });
    if (!product || !product.active) {
      throw new DomainError(`Product ${line.productId} not found or inactive`, 404);
    }
    if (line.variantOptionId) {
      const variant = await db.variantOption.findFirst({
        where: { id: line.variantOptionId, productId: line.productId },
      });
      if (!variant) throw new DomainError("Variant does not belong to that product");
    }
  }
}

export const templateService: Resource<TemplateView> = {
  async list(url) {
    const { page, take, skip } = pageParams(url);
    const q = url.searchParams.get("q")?.trim();
    const planId = Number(url.searchParams.get("planId")) || undefined;
    const where: Prisma.QuoteTemplateWhereInput = {
      ...(q ? { name: { contains: q } } : {}),
      ...(planId ? { planId } : {}),
    };
    const [items, total] = await Promise.all([
      db.quoteTemplate.findMany({ where, include, orderBy: { id: "asc" }, take, skip }),
      db.quoteTemplate.count({ where }),
    ]);
    return { items, total, page, limit: take };
  },

  get: loadTemplate,

  async create(input) {
    const data = templateSchema.parse(input);
    await assertRefs(data.planId, data.lines);
    const { lines, ...fields } = data;
    return guard(
      () =>
        db.quoteTemplate.create({
          data: {
            ...fields,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                variantOptionId: l.variantOptionId ?? null,
                quantity: l.quantity,
              })),
            },
          },
          include,
        }),
      "template",
    );
  },

  async update(id, input) {
    const patch = templatePatch.parse(input);
    if (Object.keys(patch).length === 0) throw new DomainError("Nothing to update");
    await loadTemplate(id);
    await assertRefs(patch.planId, patch.lines);
    const { lines, ...fields } = patch;

    // Replacing the lines and updating the header must succeed or fail together.
    return guard(
      () =>
        db.$transaction(async (tx) => {
          if (lines) {
            await tx.quoteTemplateLine.deleteMany({ where: { templateId: id } });
            await tx.quoteTemplateLine.createMany({
              data: lines.map((l) => ({
                templateId: id,
                productId: l.productId,
                variantOptionId: l.variantOptionId ?? null,
                quantity: l.quantity,
              })),
            });
          }
          return tx.quoteTemplate.update({ where: { id }, data: fields, include });
        }),
      "template",
    );
  },

  async remove(id) {
    await loadTemplate(id);
    // Existing subscriptions keep their own lines; they just lose the template link.
    await db.quoteTemplate.delete({ where: { id } });
    return { id, deleted: true };
  },
};
