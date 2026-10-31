import { taxService } from "@/lib/catalog/taxes";
import { itemHandlers } from "@/lib/catalog/routes";

const handlers = itemHandlers(taxService);

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
