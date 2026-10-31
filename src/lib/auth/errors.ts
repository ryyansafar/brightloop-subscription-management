export class AuthError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
