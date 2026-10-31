// Owner: fathima. Client helper for the team API shape: { ok: true, data } | { ok: false, error }.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** POST JSON to an API route. Never throws: network failures come back as { ok: false }. */
export async function postJson<T = unknown>(url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (json && typeof json.ok === "boolean") return json;
    return { ok: false, error: `Request failed (${res.status})` };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}
