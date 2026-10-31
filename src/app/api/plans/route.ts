import { planService } from "@/lib/catalog/plans";
import { collectionHandlers } from "@/lib/catalog/routes";

const handlers = collectionHandlers(planService);

export const GET = handlers.GET;
export const POST = handlers.POST;
