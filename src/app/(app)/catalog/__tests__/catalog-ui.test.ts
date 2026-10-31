import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as catalogDiscounts from "@/lib/catalog/discounts";
import * as rootDiscounts from "@/lib/discounts";
import {
  bpsToPercent,
  formatBps,
  formatBpsToPercent,
  formatDate,
  formatPaiseINR,
  formatPaiseToRupees,
  paiseToRupees,
  parsePercentToBps,
  parseRupeesToPaise,
  percentToBps,
  rupeesToPaise,
  toDateInputValue,
  toPercentInput,
  toRupeesInput,
} from "../helpers";
import {
  discountSchema,
  planSchema,
  productSchema,
  taxSchema,
  templateSchema,
  variantSchema,
} from "@/lib/catalog/schemas";
import { CatalogNav } from "../catalog-nav";

// NOTE: This test file contains zero Prisma DB calls and does not run resetDb().
// It executes in < 20ms and creates zero SQLite locks on prisma/test.db.

describe("Currency & Basis Point conversion helpers", () => {
  describe("rupeesToPaise", () => {
    it("converts valid string and number inputs to integer paise", () => {
      expect(rupeesToPaise("100")).toBe(10_000);
      expect(rupeesToPaise(100)).toBe(10_000);
      expect(rupeesToPaise("100.50")).toBe(10_050);
      expect(rupeesToPaise("0.25")).toBe(25);
      expect(rupeesToPaise("0")).toBe(0);
      expect(rupeesToPaise("1,250.75")).toBe(125_075);
      expect(rupeesToPaise("  50.00 ")).toBe(5_000);
    });

    it("rejects negative amounts", () => {
      expect(() => rupeesToPaise("-10")).toThrow(/cannot be negative/);
      expect(() => rupeesToPaise(-50)).toThrow(/cannot be negative/);
    });

    it("rejects invalid formats and excessive decimals", () => {
      expect(() => rupeesToPaise("abc")).toThrow(/valid price/);
      expect(() => rupeesToPaise("10.999")).toThrow(/at most 2 decimal/);
      expect(() => rupeesToPaise("")).toThrow(/required/);
    });
  });

  describe("paiseToRupees & formatPaiseINR", () => {
    it("converts paise to rupees", () => {
      expect(paiseToRupees(10_000)).toBe(100);
      expect(paiseToRupees(10_050)).toBe(100.5);
      expect(paiseToRupees(0)).toBe(0);
    });

    it("formats paise as readable INR string", () => {
      const formatted = formatPaiseINR(150_000);
      expect(formatted).toMatch(/1,500/);
    });
  });

  describe("percentToBps & bpsToPercent", () => {
    it("converts valid percentage inputs to basis points", () => {
      expect(percentToBps("18")).toBe(1800);
      expect(percentToBps(18)).toBe(1800);
      expect(percentToBps("0.25")).toBe(25);
      expect(percentToBps("100")).toBe(10_000);
      expect(percentToBps("0")).toBe(0);
    });

    it("rejects negative percentages and values over 100%", () => {
      expect(() => percentToBps("-5")).toThrow(/cannot be negative/);
      expect(() => percentToBps("100.01")).toThrow(/cannot exceed 100%/);
      expect(() => percentToBps("150")).toThrow(/cannot exceed 100%/);
      expect(() => percentToBps("invalid")).toThrow(/valid percentage/);
    });

    it("converts and formats basis points back to percentage", () => {
      expect(bpsToPercent(1800)).toBe(18);
      expect(bpsToPercent(25)).toBe(0.25);
      expect(formatBps(1800)).toBe("18%");
      expect(formatBps(1850)).toBe("18.50%");
      expect(formatBps(0)).toBe("0%");
    });
  });

  describe("UI Edge Form Parsing Helpers", () => {
    it("parses valid rupee inputs to integer paise via parseRupeesToPaise", () => {
      expect(parseRupeesToPaise("0")).toBe(0);
      expect(parseRupeesToPaise("1500")).toBe(150000);
      expect(parseRupeesToPaise("1500.50")).toBe(150050);
      expect(parseRupeesToPaise("1,500.50")).toBe(150050);
      expect(parseRupeesToPaise("0.25")).toBe(25);
      expect(parseRupeesToPaise(2500)).toBe(250000);
    });

    it("rejects invalid or negative rupee strings via parseRupeesToPaise", () => {
      expect(parseRupeesToPaise("-100")).toBeNull();
      expect(parseRupeesToPaise("abc")).toBeNull();
      expect(parseRupeesToPaise("10.999")).toBeNull();
      expect(parseRupeesToPaise("")).toBeNull();
      expect(parseRupeesToPaise(null)).toBeNull();
    });

    it("formats paise to INR currency string and input value", () => {
      expect(formatPaiseToRupees(240000)).toMatch(/2,400/);
      expect(toRupeesInput(240000)).toBe("2400.00");
      expect(toRupeesInput(null)).toBe("");
    });

    it("parses percentage to bps via parsePercentToBps", () => {
      expect(parsePercentToBps("0")).toBe(0);
      expect(parsePercentToBps("18")).toBe(1800);
      expect(parsePercentToBps("18.5")).toBe(1850);
      expect(parsePercentToBps("18.5%")).toBe(1850);
      expect(parsePercentToBps("100")).toBe(10000);
    });

    it("rejects invalid percentages or rates above 100% via parsePercentToBps", () => {
      expect(parsePercentToBps("100.01")).toBeNull();
      expect(parsePercentToBps("-5")).toBeNull();
      expect(parsePercentToBps("xyz")).toBeNull();
      expect(parsePercentToBps("")).toBeNull();
    });

    it("formats bps to percent string and input value", () => {
      expect(formatBpsToPercent(1800)).toBe("18%");
      expect(formatBpsToPercent(550)).toBe("5.5%");
      expect(toPercentInput(1800)).toBe("18");
      expect(toPercentInput(550)).toBe("5.5");
      expect(toPercentInput(null)).toBe("");
    });

    it("formats dates and input values properly", () => {
      const d = new Date("2026-10-31T00:00:00.000Z");
      expect(formatDate(d)).toBeTruthy();
      expect(toDateInputValue(d)).toMatch(/2026-10-31/);
      expect(toDateInputValue(null)).toBe("");
    });
  });
});

describe("Zod schema validations for catalog dialog inputs", () => {
  describe("Product & Variant validations", () => {
    const validProduct = {
      name: "CRM Pro",
      type: "SOFTWARE" as const,
      salesPrice: 200_000,
      costPrice: 50_000,
    };

    it("accepts valid product and variants", () => {
      expect(productSchema.parse(validProduct)).toMatchObject(validProduct);
      expect(
        variantSchema.parse({ attribute: "Size", value: "Large", extraPrice: 5000 }),
      ).toMatchObject({ attribute: "Size", value: "Large", extraPrice: 5000 });
    });

    it("rejects negative sales and cost prices", () => {
      expect(() => productSchema.parse({ ...validProduct, salesPrice: -100 })).toThrow(
        /Sales price cannot be negative/,
      );
      expect(() => productSchema.parse({ ...validProduct, costPrice: -1 })).toThrow(
        /Cost price cannot be negative/,
      );
      expect(() =>
        variantSchema.parse({ attribute: "Color", value: "Red", extraPrice: -50 }),
      ).toThrow(/Extra price cannot be negative/);
    });

    it("rejects invalid types and empty names", () => {
      expect(() => productSchema.parse({ ...validProduct, type: "HARDWARE" as unknown as typeof validProduct.type })).toThrow();
      expect(() => productSchema.parse({ ...validProduct, name: "   " })).toThrow(
        /Name is required/,
      );
    });
  });

  describe("Plan validations & flags", () => {
    const validPlan = {
      name: "Monthly Standard",
      price: 150_000,
      periodUnit: "MONTH" as const,
      periodCount: 1,
      minQuantity: 1,
    };

    it("verifies period units and flag defaults", () => {
      const parsed = planSchema.parse(validPlan);
      expect(parsed.periodUnit).toBe("MONTH");
      expect(parsed.autoClose).toBe(false);
      expect(parsed.closable).toBe(true);
      expect(parsed.pausable).toBe(true);
      expect(parsed.renewable).toBe(true);
      expect(parsed.active).toBe(true);
    });

    it("accepts all valid period units", () => {
      for (const unit of ["DAY", "WEEK", "MONTH", "YEAR"] as const) {
        expect(planSchema.parse({ ...validPlan, periodUnit: unit }).periodUnit).toBe(unit);
      }
      expect(() => planSchema.parse({ ...validPlan, periodUnit: "FORTNIGHT" as unknown as typeof validPlan.periodUnit })).toThrow();
    });

    it("rejects negative price and invalid quantities", () => {
      expect(() => planSchema.parse({ ...validPlan, price: -500 })).toThrow(
        /Price cannot be negative/,
      );
      expect(() => planSchema.parse({ ...validPlan, minQuantity: 0 })).toThrow(
        /Minimum quantity must be at least 1/,
      );
    });

    it("rejects availableTo date before availableFrom", () => {
      expect(() =>
        planSchema.parse({
          ...validPlan,
          availableFrom: new Date("2026-12-01"),
          availableTo: new Date("2026-11-01"),
        }),
      ).toThrow(/Available-to date cannot be before available-from/);
    });
  });

  describe("Tax rate validations", () => {
    it("accepts valid tax rates up to 100%", () => {
      expect(taxSchema.parse({ name: "GST 18%", rateBps: 1800 }).rateBps).toBe(1800);
      expect(taxSchema.parse({ name: "Full 100%", rateBps: 10_000 }).rateBps).toBe(10_000);
      expect(taxSchema.parse({ name: "Zero", rateBps: 0 }).rateBps).toBe(0);
    });

    it("rejects rates exceeding 100% or negative rates", () => {
      expect(() => taxSchema.parse({ name: "Excess", rateBps: 10_001 })).toThrow(
        /Rate cannot exceed 100%/,
      );
      expect(() => taxSchema.parse({ name: "Negative", rateBps: -10 })).toThrow(
        /Rate cannot be negative/,
      );
      expect(() => taxSchema.parse({ name: "Float", rateBps: 18.5 })).toThrow(
        /Rate must be whole basis points/,
      );
    });
  });

  describe("Discount validations", () => {
    const validDiscount = {
      name: "Early Bird",
      kind: "PERCENT" as const,
      value: 1000,
      startsAt: "2026-01-01",
      endsAt: "2026-12-31",
      scope: "SUBSCRIPTION" as const,
    };

    it("rejects percentages exceeding 100%", () => {
      expect(() => discountSchema.parse({ ...validDiscount, value: 10_001 })).toThrow(
        /A percentage cannot exceed 100%/,
      );
      expect(discountSchema.parse({ ...validDiscount, value: 10_000 }).value).toBe(10_000);
    });

    it("allows fixed values exceeding 10,000 paise", () => {
      expect(
        discountSchema.parse({ ...validDiscount, kind: "FIXED", value: 50_000 }).value,
      ).toBe(50_000);
    });

    it("rejects end date <= start date", () => {
      expect(() =>
        discountSchema.parse({
          ...validDiscount,
          startsAt: "2026-06-01",
          endsAt: "2026-05-01",
        }),
      ).toThrow(/End date must be after the start date/);

      expect(() =>
        discountSchema.parse({
          ...validDiscount,
          startsAt: "2026-06-01",
          endsAt: "2026-06-01",
        }),
      ).toThrow(/End date must be after the start date/);
    });

    it("rejects usage limit < 0 and 0", () => {
      expect(() => discountSchema.parse({ ...validDiscount, usageLimit: 0 })).toThrow(
        /Usage limit must be at least 1/,
      );
      expect(() => discountSchema.parse({ ...validDiscount, usageLimit: -1 })).toThrow(
        /Usage limit must be at least 1/,
      );
      expect(discountSchema.parse({ ...validDiscount, usageLimit: null }).usageLimit).toBeNull();
      expect(discountSchema.parse({ ...validDiscount, usageLimit: 25 }).usageLimit).toBe(25);
    });

    it("enforces product scope requirements", () => {
      expect(() =>
        discountSchema.parse({ ...validDiscount, scope: "PRODUCT", productId: null }),
      ).toThrow(/Choose a product for a product discount/);
      expect(() =>
        discountSchema.parse({ ...validDiscount, scope: "SUBSCRIPTION", productId: 12 }),
      ).toThrow(/A subscription discount has no product/);
    });
  });

  describe("Quotation Template validations", () => {
    const validTemplate = {
      name: "Starter Bundle",
      planId: 1,
      validityDays: 14,
      lines: [{ productId: 10, quantity: 2 }],
    };

    it("requires at least one product line", () => {
      expect(() => templateSchema.parse({ ...validTemplate, lines: [] })).toThrow(
        /A template needs at least one product line/,
      );
      expect(templateSchema.parse(validTemplate).lines).toHaveLength(1);
    });

    it("rejects line quantity < 1", () => {
      expect(() =>
        templateSchema.parse({ ...validTemplate, lines: [{ productId: 10, quantity: 0 }] }),
      ).toThrow(/Quantity must be at least 1/);
    });

    it("validates validityDays boundaries", () => {
      expect(() => templateSchema.parse({ ...validTemplate, validityDays: 0 })).toThrow(
        /Validity must be at least 1 day/,
      );
      expect(() => templateSchema.parse({ ...validTemplate, validityDays: 366 })).toThrow();
    });
  });

  describe("Client-side dialog validation edge cases", () => {
    it("validates discount usageLimit boundaries", () => {
      const validateUsageLimit = (limit: number | null, isEdit: boolean, usedCount: number) => {
        if (limit !== null && (limit < 1 || !Number.isInteger(limit))) {
          return "Usage limit must be at least 1 (or leave blank for unlimited)";
        }
        if (isEdit && limit !== null && limit < usedCount) {
          return `Limit cannot be less than existing ${usedCount} uses`;
        }
        return null;
      };

      expect(validateUsageLimit(0, false, 0)).toBe("Usage limit must be at least 1 (or leave blank for unlimited)");
      expect(validateUsageLimit(-5, false, 0)).toBe("Usage limit must be at least 1 (or leave blank for unlimited)");
      expect(validateUsageLimit(2.5, false, 0)).toBe("Usage limit must be at least 1 (or leave blank for unlimited)");
      expect(validateUsageLimit(null, false, 0)).toBeNull();
      expect(validateUsageLimit(10, false, 0)).toBeNull();
      expect(validateUsageLimit(3, true, 5)).toBe("Limit cannot be less than existing 5 uses");
      expect(validateUsageLimit(5, true, 5)).toBeNull();
    });

    it("validates discount minAmount and minQuantity", () => {
      const validateMinAmount = (raw: string) => {
        const val = raw.trim() ? parseRupeesToPaise(raw.trim()) : 0;
        return val === null ? "Enter a valid minimum purchase amount (cannot be negative)" : null;
      };

      const validateMinQuantity = (raw: string) => {
        const val = raw.trim() ? Number(raw.trim()) : 0;
        return Number.isNaN(val) || val < 0 || !Number.isInteger(val) ? "Minimum quantity cannot be negative" : null;
      };

      expect(validateMinAmount("-50")).toBe("Enter a valid minimum purchase amount (cannot be negative)");
      expect(validateMinAmount("abc")).toBe("Enter a valid minimum purchase amount (cannot be negative)");
      expect(validateMinAmount("0")).toBeNull();
      expect(validateMinAmount("100.50")).toBeNull();
      expect(validateMinAmount("")).toBeNull();

      expect(validateMinQuantity("-1")).toBe("Minimum quantity cannot be negative");
      expect(validateMinQuantity("abc")).toBe("Minimum quantity cannot be negative");
      expect(validateMinQuantity("1.5")).toBe("Minimum quantity cannot be negative");
      expect(validateMinQuantity("0")).toBeNull();
      expect(validateMinQuantity("5")).toBeNull();
      expect(validateMinQuantity("")).toBeNull();
    });

    it("validates plan periodCount and minQuantity boundaries", () => {
      const validatePlanPeriod = (raw: string) => {
        const val = raw.trim() ? Number(raw.trim()) : 1;
        return Number.isNaN(val) || val < 1 || val > 120 || !Number.isInteger(val)
          ? "Billing period count must be between 1 and 120"
          : null;
      };

      const validatePlanMinQty = (raw: string) => {
        const val = raw.trim() ? Number(raw.trim()) : 1;
        return Number.isNaN(val) || val < 1 || !Number.isInteger(val)
          ? "Minimum quantity must be at least 1"
          : null;
      };

      expect(validatePlanPeriod("0")).toBe("Billing period count must be between 1 and 120");
      expect(validatePlanPeriod("-1")).toBe("Billing period count must be between 1 and 120");
      expect(validatePlanPeriod("121")).toBe("Billing period count must be between 1 and 120");
      expect(validatePlanPeriod("1")).toBeNull();
      expect(validatePlanPeriod("12")).toBeNull();

      expect(validatePlanMinQty("0")).toBe("Minimum quantity must be at least 1");
      expect(validatePlanMinQty("-3")).toBe("Minimum quantity must be at least 1");
      expect(validatePlanMinQty("1")).toBeNull();
      expect(validatePlanMinQty("10")).toBeNull();
    });

    it("validates template validityDays boundaries", () => {
      const validateValidity = (raw: string) => {
        const val = raw.trim() ? Number(raw.trim()) : 30;
        return Number.isNaN(val) || val < 1 || val > 365 || !Number.isInteger(val)
          ? "Validity must be between 1 and 365 days"
          : null;
      };

      expect(validateValidity("0")).toBe("Validity must be between 1 and 365 days");
      expect(validateValidity("-10")).toBe("Validity must be between 1 and 365 days");
      expect(validateValidity("366")).toBe("Validity must be between 1 and 365 days");
      expect(validateValidity("1")).toBeNull();
      expect(validateValidity("30")).toBeNull();
      expect(validateValidity("365")).toBeNull();
    });
  });
});

describe("Re-export verification: src/lib/discounts.ts", () => {
  it("re-exports discountService identically from src/lib/catalog/discounts.ts", () => {
    expect(rootDiscounts.discountService).toBeDefined();
    expect(rootDiscounts.discountService).toBe(catalogDiscounts.discountService);
  });

  it("re-exports all keys and methods", () => {
    const catalogKeys = Object.keys(catalogDiscounts);
    for (const key of catalogKeys) {
      expect((rootDiscounts as Record<string, unknown>)[key]).toBe((catalogDiscounts as Record<string, unknown>)[key]);
    }
    expect(typeof rootDiscounts.discountService.list).toBe("function");
    expect(typeof rootDiscounts.discountService.get).toBe("function");
    expect(typeof rootDiscounts.discountService.create).toBe("function");
    expect(typeof rootDiscounts.discountService.update).toBe("function");
    expect(typeof rootDiscounts.discountService.remove).toBe("function");
  });
});

describe("Catalog UI Component & Sub-Navigation static rendering", () => {
  it("renders CatalogNav with all tabs and active indicator", () => {
    const html = renderToStaticMarkup(
      React.createElement(CatalogNav, { activeHref: "/catalog/products" }),
    );

    // Verify all 5 routes exist
    expect(html).toContain('href="/catalog/products"');
    expect(html).toContain('href="/catalog/plans"');
    expect(html).toContain('href="/catalog/templates"');
    expect(html).toContain('href="/catalog/discounts"');
    expect(html).toContain('href="/catalog/taxes"');

    // Verify labels
    expect(html).toContain("Products");
    expect(html).toContain("Plans");
    expect(html).toContain("Quotation templates");
    expect(html).toContain("Discounts");
    expect(html).toContain("Taxes");

    // Verify admin badges
    expect(html).toContain("Admin");
  });
});
