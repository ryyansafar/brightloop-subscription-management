import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailConfigured, escapeHtml, sendEmail, type EmailMessage } from "./mail";

const message: EmailMessage = {
  to: "customer@example.com", subject: "Invoice", text: "Text", html: "<p>Text</p>", idempotencyKey: "invoice/test",
};
const request = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "resend");
  vi.stubEnv("RESEND_API_KEY", "re_private_test_key");
  vi.stubEnv("EMAIL_FROM", "billing@example.com");
  request.mockReset().mockResolvedValue(Response.json({ id: "email-123" }));
  vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("transactional transport", () => {
  it("sends server-side with a fixed HTTPS endpoint, timeout and idempotency key", async () => {
    await sendEmail(message);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options).toMatchObject({ method: "POST", cache: "no-store", redirect: "error", headers: {
      Authorization: "Bearer re_private_test_key", "Idempotency-Key": "invoice/test",
    } });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options!.body as string)).toEqual({ from: "billing@example.com", to: [message.to], subject: message.subject, text: message.text, html: message.html });
  });

  it.each(["", "disabled", "unknown"])("does not send for provider %j", async (provider) => {
    vi.stubEnv("EMAIL_PROVIDER", provider);
    expect(emailConfigured()).toBe(false);
    await expect(sendEmail(message)).rejects.toThrow(/not configured/);
    expect(request).not.toHaveBeenCalled();
  });

  it.each(["", "bad address", "Sender <valid@example.com>", "a@example.com\r\nBcc:b@example.com"])("rejects an invalid sender %j", async (sender) => {
    vi.stubEnv("EMAIL_FROM", sender);
    expect(emailConfigured()).toBe(false);
    await expect(sendEmail(message)).rejects.toThrow(/not configured/);
    expect(request).not.toHaveBeenCalled();
  });

  it("requires a key and validates recipients and header text before sending", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(emailConfigured()).toBe(false);
    await expect(sendEmail(message)).rejects.toThrow(/not configured/);
    vi.stubEnv("RESEND_API_KEY", "re_test");
    await expect(sendEmail({ ...message, to: "bad" })).rejects.toThrow(/invalid/);
    await expect(sendEmail({ ...message, subject: "Invoice\r\nBcc: other@example.com" })).rejects.toThrow(/invalid/);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([400, 401, 403, 429, 500])("returns a safe failure for provider status %i", async (status) => {
    request.mockResolvedValue(Response.json({ message: "secret-token re_private_test_key" }, { status }));
    await expect(sendEmail(message)).rejects.toThrow("Email could not be sent. Please try again later");
  });

  it("handles timeouts/network errors and malformed success responses without leaking details", async () => {
    request.mockRejectedValueOnce(new Error("private recipient and secret-token"));
    await expect(sendEmail(message)).rejects.toThrow("Email could not be sent. Please try again later");
    request.mockResolvedValueOnce(Response.json({}));
    await expect(sendEmail(message)).rejects.toThrow(/could not be sent/);
    request.mockResolvedValueOnce(new Response("not JSON"));
    await expect(sendEmail(message)).rejects.toThrow(/could not be sent/);
  });

  it("escapes untrusted text in HTML templates", () => {
    expect(escapeHtml('<script a="x">&\'</script>')).toBe("&lt;script a=&quot;x&quot;&gt;&amp;&#39;&lt;/script&gt;");
  });
});
