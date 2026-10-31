import { planService } from "@/lib/catalog/plans";
import { itemHandlers } from "@/lib/catalog/routes";

const handlers = itemHandlers(planService);

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
