// Owner: fathima. List state (filters, search, page) lives in the URL so lists work as server components.

export type Params = Record<string, string | string[] | undefined>;

/** Build `basePath?...` from the current params with some keys changed (undefined removes a key). */
export function hrefWith(basePath: string, current: Params, changes: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string" && value !== "") qs.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") qs.delete(key);
    else qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Read a single string param (Next gives string | string[] | undefined). */
export function param(params: Params, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** Page number from `?page=`, at least 1. */
export function pageParam(params: Params): number {
  const page = Number(param(params, "page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}
