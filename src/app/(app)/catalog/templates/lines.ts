export interface TemplateLineDraft {
  productId: number;
  variantOptionId?: number | null;
  quantity: number;
}

interface SourceLine {
  productId: number;
  variantOptionId: number | null;
  quantity: number;
}

/** Lines shown when the template dialog opens: the template's own lines, or one default line for a new template. */
export function initialTemplateLines(
  template: { lines: SourceLine[] } | null,
  products: { id: number }[],
): TemplateLineDraft[] {
  if (template && template.lines.length > 0) {
    return template.lines.map((l) => ({
      productId: l.productId,
      variantOptionId: l.variantOptionId,
      quantity: l.quantity,
    }));
  }
  return products.length > 0 ? [{ productId: products[0].id, quantity: 1 }] : [];
}
