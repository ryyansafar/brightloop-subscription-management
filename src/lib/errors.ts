/** An expected, user-facing failure, including temporarily unavailable external services. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 503 = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
