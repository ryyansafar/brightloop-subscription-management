import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { resolveUser, type SessionUser } from "./api-auth";
import { DomainError } from "./errors";
import type { Role } from "./state";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

interface HandlerArgs<P> {
  request: Request;
  user: SessionUser;
  params: P;
}

/**
 * Wrap a route handler: authenticate, enforce roles on the server, resolve
 * params, and turn validation / domain errors into `{ ok: false, error }`.
 */
export function handle<P extends Record<string, string> = Record<string, never>>(
  roles: readonly Role[],
  fn: (args: HandlerArgs<P>) => Promise<Response>,
) {
  return async (request: Request, context?: { params: Promise<P> }): Promise<Response> => {
    try {
      const user = await resolveUser(request);
      if (!user) return fail("You are not signed in", 401);
      if (!roles.includes(user.role)) return fail("You do not have access to this", 403);
      const params = context ? await context.params : ({} as P);
      return await fn({ request, user, params });
    } catch (error) {
      // Next uses thrown signals to defer request-dependent routes during prerendering.
      unstable_rethrow(error);
      if (error instanceof ZodError) {
        const message = error.issues
          .filter((issue) => issue.code !== "unrecognized_keys")
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
          .join("; ");
        return fail(message || "Invalid request", 400);
      }
      if (error instanceof DomainError) return fail(error.message, error.status);
      console.error("Unhandled API error", { name: error instanceof Error ? error.constructor.name : "Unknown" });
      return fail("Something went wrong", 500);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DomainError("Request body must be valid JSON");
  }
}

export function intParam(value: string, label = "id"): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) throw new DomainError(`Invalid ${label}`, 400);
  return parsed;
}

export function pageParams(url: URL): { page: number; take: number; skip: number } {
  const read = (name: string, fallback: number, maximum: number) => {
    const raw = url.searchParams.get(name);
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) throw new DomainError(`Invalid ${name}`, 400);
    return Math.min(value, maximum);
  };
  const page = read("page", 1, 10_000);
  const take = read("limit", 50, 100);
  return { page, take, skip: (page - 1) * take };
}

/** Customers only ever see rows that belong to their own account. */
export function ownCustomerFilter(user: SessionUser): { customer?: { userId: number } } {
  return user.role === "CUSTOMER" ? { customer: { userId: user.id } } : {};
}
