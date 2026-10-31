import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  // Mutations are authorized in their route handlers and return JSON errors.
  if (!["GET", "HEAD"].includes(request.method)) return NextResponse.next();
  const user = await getSessionUser(request);
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  const path = request.nextUrl.pathname;
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  const isPortal = path === "/portal" || path.startsWith("/portal/");
  if ((isAdmin && user.role !== "ADMIN") || (!isPortal && user.role === "CUSTOMER")) {
    return NextResponse.redirect(new URL(user.role === "CUSTOMER" ? "/portal" : "/dashboard", request.url));
  }
  return NextResponse.next();
}

// API handlers enforce their own roles and row ownership, including when called directly.
export const config = {
  matcher: ["/dashboard/:path*", "/subscriptions/:path*", "/invoices/:path*", "/payments/:path*", "/catalog/:path*", "/admin/:path*", "/portal/:path*"],
};
