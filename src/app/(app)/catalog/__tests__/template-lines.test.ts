import { describe, expect, it } from "vitest";
import { initialTemplateLines } from "../templates/lines";

const products = [{ id: 7 }, { id: 9 }];

describe("initialTemplateLines", () => {
  it("uses the template's real lines when editing", () => {
    const template = {
      lines: [
        { productId: 9, variantOptionId: 4, quantity: 3 },
        { productId: 7, variantOptionId: null, quantity: 1 },
      ],
    };
    expect(initialTemplateLines(template, products)).toEqual([
      { productId: 9, variantOptionId: 4, quantity: 3 },
      { productId: 7, variantOptionId: null, quantity: 1 },
    ]);
  });

  it("starts a new template with one default line", () => {
    expect(initialTemplateLines(null, products)).toEqual([{ productId: 7, quantity: 1 }]);
  });

  it("falls back to the default line for a template without lines", () => {
    expect(initialTemplateLines({ lines: [] }, products)).toEqual([{ productId: 7, quantity: 1 }]);
  });

  it("returns no lines when there are no products", () => {
    expect(initialTemplateLines(null, [])).toEqual([]);
  });

  it("does not share state with the source template", () => {
    const template = { lines: [{ productId: 7, variantOptionId: null, quantity: 2 }] };
    const result = initialTemplateLines(template, products);
    expect(result[0]).not.toBe(template.lines[0]);
  });
});
