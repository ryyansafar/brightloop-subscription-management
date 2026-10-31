/** Use operator-controlled configuration, never a request's Host header, for trust decisions. */
export function appOrigin(): string {
  const configured = process.env.APP_ORIGIN;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN is required in production");
  }
  const url = new URL(configured || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("APP_ORIGIN must be an HTTP(S) origin without a path or credentials");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use HTTPS in production");
  }
  return url.origin;
}

export function isLoopbackHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export function devMailerEnabled(): boolean {
  return process.env.AUTH_DEV_MAILER === "1" && process.env.NODE_ENV === "development" &&
    isLoopbackHost(new URL(appOrigin()).hostname);
}

/** Production is fail-closed by default; tests/local demos can explicitly disable the signup gate. */
export function emailVerificationEnabled(): boolean {
  return process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "1" ||
    (process.env.NODE_ENV === "production" && process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "0");
}

export function needsEmailVerification(user: { emailVerificationRequired: boolean; emailVerifiedAt: Date | null }): boolean {
  return emailVerificationEnabled() && user.emailVerificationRequired && !user.emailVerifiedAt;
}
