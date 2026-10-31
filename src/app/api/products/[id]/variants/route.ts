import { handle, intParam, ok, readJson } from "@/lib/api";
import { addVariant } from "@/lib/catalog/products";
import { CATALOG_WRITE } from "@/lib/catalog/routes";

export const POST = handle<{ id: string }>(CATALOG_WRITE, async ({ request, params }) =>
  ok(await addVariant(intParam(params.id), await readJson(request)), 201),
);
