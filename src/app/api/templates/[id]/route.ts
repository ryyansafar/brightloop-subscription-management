import { templateService } from "@/lib/catalog/templates";
import { itemHandlers } from "@/lib/catalog/routes";

const handlers = itemHandlers(templateService);

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
