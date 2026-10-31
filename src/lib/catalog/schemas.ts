import { z } from "zod";
import { DISCOUNT_KINDS, DISCOUNT_SCOPES, PERIOD_UNITS } from "../state";

export const PRODUCT_TYPES = ["SOFTWARE", "ADDON", "SERVICE"] as const;

const paise = (label: string) =>
  z.number({ error: `${label} must be a number` }).int(`${label} must be whole paise`).min(0, `${label} cannot be negative`);
const name = z.string().trim().min(1, "Name is required").max(120, "Name is too long");
const flag = z.boolean();

export const variantSchema = z.object({
  attribute: z.string().trim().min(1, "Attribute is required").max(60),
  value: z.string().trim().min(1, "Value is required").max(60),
  extraPrice: paise("Extra price").default(0),
});

export const productSchema = z.object({
  name,
  type: z.enum(PRODUCT_TYPES),
  salesPrice: paise("Sales price"),
  costPrice: paise("Cost price").default(0),
  notes: z.string().trim().max(1000).nullish(),
  active: flag.default(true),
  variants: z.array(variantSchema).max(30).optional(),
});

export const planBase = z.object({
    name,
    price: paise("Price"),
    periodUnit: z.enum(PERIOD_UNITS),
    periodCount: z.number().int().min(1, "Billing period must be at least 1").max(120).default(1),
    minQuantity: z.number().int().min(1, "Minimum quantity must be at least 1").default(1),
    availableFrom: z.coerce.date().nullish(),
    availableTo: z.coerce.date().nullish(),
    autoClose: flag.default(false),
    closable: flag.default(true),
    pausable: flag.default(true),
    renewable: flag.default(true),
    active: flag.default(true),
  });

export const planSchema = planBase
  .refine((p) => !p.availableFrom || !p.availableTo || p.availableTo >= p.availableFrom, {
    message: "Available-to date cannot be before available-from",
    path: ["availableTo"],
  });

export const taxSchema = z.object({
  name,
  rateBps: z
    .number()
    .int("Rate must be whole basis points (1800 = 18%)")
    .min(0, "Rate cannot be negative")
    .max(10_000, "Rate cannot exceed 100%"),
  active: flag.default(true),
});

export const discountBase = z.object({
    name,
    kind: z.enum(DISCOUNT_KINDS),
    value: z.number().int("Value must be a whole number").min(1, "Value must be greater than zero"),
    minAmount: paise("Minimum purchase").default(0),
    minQuantity: z.number().int().min(0, "Minimum quantity cannot be negative").default(0),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    usageLimit: z.number().int().min(1, "Usage limit must be at least 1").nullish(),
    scope: z.enum(DISCOUNT_SCOPES),
    productId: z.number().int().positive().nullish(),
    active: flag.default(true),
  });

export const discountSchema = discountBase
  .superRefine((d, ctx) => {
    if (d.kind === "PERCENT" && d.value > 10_000) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage cannot exceed 100%" });
    }
    if (d.endsAt <= d.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End date must be after the start date" });
    }
    if (d.scope === "PRODUCT" && !d.productId) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "Choose a product for a product discount" });
    }
    if (d.scope === "SUBSCRIPTION" && d.productId) {
      ctx.addIssue({ code: "custom", path: ["productId"], message: "A subscription discount has no product" });
    }
  });

export const templateSchema = z.object({
  name,
  planId: z.number().int().positive(),
  validityDays: z.number().int().min(1, "Validity must be at least 1 day").max(365).default(30),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        variantOptionId: z.number().int().positive().nullish(),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
      }),
    )
    .min(1, "A template needs at least one product line"),
});
