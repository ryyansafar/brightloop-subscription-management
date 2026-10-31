import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";
import { assertSameOrigin, AuthError } from "./security";

export function authJson(data: unknown, status = 200, cookie?: string): Response {
  return Response.json({ ok: true, data }, {
    status,
    headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
}

/** Keep validation errors readable and never send database errors or credentials to clients. */
export function authHandler(fn: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      assertSameOrigin(request);
      return await fn(request);
    } catch (error) {
      let status = 500;
      let message = "Something went wrong";
      if (error instanceof ZodError) {
        status = 400;
        message = error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
      } else if (error instanceof AuthError || error instanceof DomainError) {
        status = error.status;
        message = error.message;
      } else {
        // Avoid logging error objects that may contain SQL parameters or reset tokens.
        console.error("Unhandled authentication error");
      }
      return Response.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
    }
  };
}

export async function authBody(request: Request): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new AuthError("Request body must be valid JSON", 400); }
}
