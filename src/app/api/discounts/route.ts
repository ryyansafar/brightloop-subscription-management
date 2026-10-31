import { discountService } from "@/lib/catalog/discounts";
import { collectionHandlers } from "@/lib/catalog/routes";

const handlers = collectionHandlers(discountService);

export const GET = handlers.GET;
export const POST = handlers.POST;
