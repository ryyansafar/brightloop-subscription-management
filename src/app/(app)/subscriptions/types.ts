// Plain, serialisable shapes passed from server pages to the client form components.

export interface CatalogVariant {
  id: number;
  attribute: string;
  value: string;
  extraPrice: number;
}

export interface CatalogProduct {
  id: number;
  name: string;
  salesPrice: number;
  variants: CatalogVariant[];
}

export interface CatalogPlan {
  id: number;
  name: string;
  /** list price per period, in paise */
  price: number;
  periodUnit: string;
  periodCount: number;
  minQuantity: number;
  availableFrom: string | null;
  availableTo: string | null;
}

export interface CatalogTax {
  id: number;
  name: string;
  rateBps: number;
}

export interface CatalogTemplate {
  id: number;
  name: string;
  planId: number;
  lines: { productId: number; variantOptionId: number | null; quantity: number }[];
}

export interface EditorLine {
  /** stable React key, not sent to the API */
  key: string;
  productId: number | null;
  variantOptionId: number | null;
  quantity: number;
  taxRateId: number | null;
}
