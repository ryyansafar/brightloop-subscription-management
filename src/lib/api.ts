import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { resolveUser, type SessionUser } from "./api-auth";
import { DomainError } from "./errors";
import type { Role } from "./state";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
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
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
          .join("; ");
        return fail(message, 400);
      }
      if (error instanceof DomainError) return fail(error.message, error.status);
      console.error("Unhandled API error", error);
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
  if (!Number.isInteger(parsed) || parsed < 1) throw new DomainError(`Invalid ${label}`, 400);
  return parsed;
}

export function pageParams(url: URL): { page: number; take: number; skip: number } {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  return { page, take, skip: (page - 1) * take };
}

/** Customers only ever see rows that belong to their own account. */
export function ownCustomerFilter(user: SessionUser): { customer?: { userId: number } } {
  return user.role === "CUSTOMER" ? { customer: { userId: user.id } } : {};
}
