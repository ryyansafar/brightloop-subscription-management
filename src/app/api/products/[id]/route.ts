import { productService } from "@/lib/catalog/products";
import { itemHandlers } from "@/lib/catalog/routes";

const handlers = itemHandlers(productService);

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
