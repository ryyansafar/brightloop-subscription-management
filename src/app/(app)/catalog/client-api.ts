export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Client helper for all catalog mutations (POST, PATCH, DELETE).
 * Never throws: network or HTTP failures return `{ ok: false, error }`.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: { method?: "POST" | "PATCH" | "DELETE" | "GET"; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const method = options.method ?? "POST";
    const res = await fetch(url, {
      method,
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (json && typeof json.ok === "boolean") return json;
    return { ok: false, error: `Request failed with status ${res.status}` };
  } catch {
    return { ok: false, error: "Could not reach the server. Please check your connection." };
  }
}
