import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

const publicPages = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

export async function proxy(request: NextRequest) {
  let path: string;
  try {
    path = decodeURIComponent(request.nextUrl.pathname).replace(/\/+$/, "") || "/";
    if (path.includes("\\")) throw new Error("Ambiguous path");
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (path === "/") {
    const user = await getSessionUser(request);
    const response = NextResponse.redirect(new URL(user ? user.role === "CUSTOMER" ? "/portal" : "/dashboard" : "/login", request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  if (publicPages.has(path)) {
    const response = NextResponse.next();
    if (path === "/reset-password") response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
  // Mutations are authorized in their route handlers and return JSON errors.
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const user = await getSessionUser(request);
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  // Pages only the admin may open (the matching APIs enforce the same rule themselves).
  const isAdmin = ["/admin", "/billing"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  const isPortal = path === "/portal" || path.startsWith("/portal/");
  if ((isAdmin && user.role !== "ADMIN") || (!isPortal && user.role === "CUSTOMER")) {
    return NextResponse.redirect(new URL(user.role === "CUSTOMER" ? "/portal" : "/dashboard", request.url));
  }
  return NextResponse.next();
}

// API handlers enforce their own roles and row ownership, including when called directly.
export const config = {
  // Public assets are explicit: a new /reports.csv page must not accidentally bypass protection.
  matcher: ["/((?!api(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|(?:file|globe|next|vercel|window)\\.svg$).*)"],
};
