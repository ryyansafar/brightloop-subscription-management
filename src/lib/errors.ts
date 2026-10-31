/** An expected, user-facing failure (bad input, invalid transition, missing record). */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
