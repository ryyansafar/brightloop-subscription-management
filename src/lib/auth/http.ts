import { ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { assertSameOrigin, AuthError, limitAuthSource } from "./security";

export const MAX_AUTH_BODY_BYTES = 16 * 1024;

export function authJson(data: unknown, status = 200, cookie?: string): Response {
  return Response.json({ ok: true, data }, {
    status,
    headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
}

/** Keep validation errors readable and never send database errors or credentials to clients. */
export function authHandler(fn: (request: Request) => Promise<Response>, options: { limited?: boolean } = {}) {
  return async (request: Request): Promise<Response> => {
    try {
      assertSameOrigin(request);
      if (options.limited) limitAuthSource(request);
      return await fn(request);
    } catch (error) {
      // Preserve Next's request-time/prerender control flow rather than converting it into a 500.
      unstable_rethrow(error);
      let status = 500;
      let message = "Something went wrong";
      if (error instanceof ZodError) {
        status = 400;
        message = error.issues.filter((issue) => issue.code !== "unrecognized_keys")
          .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ") || "Invalid request";
      } else if (error instanceof AuthError || error instanceof DomainError) {
        status = error.status;
        message = error.message;
      } else {
        // Avoid logging error objects that may contain SQL parameters or reset tokens.
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        console.error("Unhandled authentication error", {
          name: error instanceof Error ? error.constructor.name : "Unknown",
          ...(/^P\d{4}$/.test(code) ? { code } : {}),
        });
      }
      return Response.json({ ok: false, error: message }, {
        status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "900" } : {}) },
      });
    }
  };
}

export async function authBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AuthError("Content-Type must be application/json", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_AUTH_BODY_BYTES) {
    throw new AuthError("Request body is too large", 413);
  }
  if (!request.body) throw new AuthError("Request body must be valid JSON", 400);
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_AUTH_BODY_BYTES) {
        await reader.cancel();
        throw new AuthError("Request body is too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError("Request body must be valid JSON", 400);
  } finally {
    reader.releaseLock();
  }
}
