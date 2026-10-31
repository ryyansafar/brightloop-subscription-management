// Only same-origin, in-app paths may be used as a post-login destination.

const AUTH_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

/** Returns the path if it is a plain internal path, otherwise null. Rejects //host, /\host, schemes and control chars. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.length > 2000) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null;
  try {
    if (new URL(next, "http://app.local").origin !== "http://app.local") return null;
  } catch {
    return null;
  }
  const path = next.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return AUTH_PATHS.includes(path) ? null : next;
}

/** Where to go after signing in. Customers only ever land inside /portal. */
export function destinationFor(role: string, next: string | null | undefined): string {
  const safe = safeNext(next);
  if (role === "CUSTOMER") {
    const inPortal = safe !== null && /^\/portal(?:[/?#]|$)/.test(safe);
    return inPortal ? safe : "/portal";
  }
  return safe ?? "/dashboard";
}
