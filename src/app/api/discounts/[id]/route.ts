import { discountService } from "@/lib/catalog/discounts";
import { itemHandlers } from "@/lib/catalog/routes";

const handlers = itemHandlers(discountService);

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
