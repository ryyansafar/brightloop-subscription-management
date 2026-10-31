import type { Role } from "@/lib/state";

/** A redirect target is untrusted input, including when it originally came from the proxy. */
export function loginDestination(next: string | undefined, role: Role): string {
  const home = role === "CUSTOMER" ? "/portal" : "/dashboard";
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020]/.test(next)) return home;
  try {
    const url = new URL(next, "https://brightloop.invalid");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://brightloop.invalid" || path.startsWith("//") || path.includes("\\")) return home;
    if (/^\/(api|login|signup|forgot-password|reset-password|verify-email)(\/|$)/.test(path) || path === "/") return home;
    if (role === "CUSTOMER" && !/^\/portal(\/|$)/.test(path)) return home;
    if (role === "STAFF" && /^\/admin(\/|$)/.test(path)) return home;
    return url.pathname + url.search + url.hash;
  } catch { return home; }
}
