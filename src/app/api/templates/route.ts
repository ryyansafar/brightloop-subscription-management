import { templateService } from "@/lib/catalog/templates";
import { collectionHandlers } from "@/lib/catalog/routes";

const handlers = collectionHandlers(templateService);

export const GET = handlers.GET;
export const POST = handlers.POST;
