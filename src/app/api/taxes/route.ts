import { taxService } from "@/lib/catalog/taxes";
import { collectionHandlers } from "@/lib/catalog/routes";

const handlers = collectionHandlers(taxService);

export const GET = handlers.GET;
export const POST = handlers.POST;
