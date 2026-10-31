import { productService } from "@/lib/catalog/products";
import { collectionHandlers } from "@/lib/catalog/routes";

const handlers = collectionHandlers(productService);

export const GET = handlers.GET;
export const POST = handlers.POST;
