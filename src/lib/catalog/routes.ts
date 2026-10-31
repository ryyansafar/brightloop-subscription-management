import { handle, intParam, ok, readJson } from "../api";
import type { Resource } from "./resource";

/** Everyone on the team can read the catalog; only the admin changes it. */
export const CATALOG_READ = ["ADMIN", "STAFF"] as const;
export const CATALOG_WRITE = ["ADMIN"] as const;

export function collectionHandlers<T>(resource: Resource<T>) {
  return {
    GET: handle(CATALOG_READ, async ({ request }) => ok(await resource.list(new URL(request.url)))),
    POST: handle(CATALOG_WRITE, async ({ request }) =>
      ok(await resource.create(await readJson(request)), 201),
    ),
  };
}

export function itemHandlers<T>(resource: Resource<T>) {
  return {
    GET: handle<{ id: string }>(CATALOG_READ, async ({ params }) =>
      ok(await resource.get(intParam(params.id))),
    ),
    PATCH: handle<{ id: string }>(CATALOG_WRITE, async ({ request, params }) =>
      ok(await resource.update(intParam(params.id), await readJson(request))),
    ),
    DELETE: handle<{ id: string }>(CATALOG_WRITE, async ({ params }) =>
      ok(await resource.remove(intParam(params.id))),
    ),
  };
}
