import { handle, intParam, ok, readJson } from "@/lib/api";
import { removeVariant, updateVariant } from "@/lib/catalog/products";
import { CATALOG_WRITE } from "@/lib/catalog/routes";

type Params = { id: string; variantId: string };

export const PATCH = handle<Params>(CATALOG_WRITE, async ({ request, params }) =>
  ok(await updateVariant(intParam(params.id), intParam(params.variantId, "variant id"), await readJson(request))),
);

export const DELETE = handle<Params>(CATALOG_WRITE, async ({ params }) =>
  ok(await removeVariant(intParam(params.id), intParam(params.variantId, "variant id"))),
);
