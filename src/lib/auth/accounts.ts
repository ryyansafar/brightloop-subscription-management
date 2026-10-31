import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthError, clearAuthAttempts, limitAuthAttempt } from "./security";
import { hashPassword, verifyPassword } from "./password-work";
import { loginSchema, signupSchema } from "./validation";
import { needsEmailVerification } from "./config";

export async function createAccount(input: unknown, source: string, role: "CUSTOMER" | "STAFF" = "CUSTOMER") {
  const data = signupSchema.parse(input);
  await limitAuthAttempt("signup", data.email, source);
  const passwordHash = await hashPassword(data.password);
  try {
    return await db.user.create({
      data: {
        name: data.name, email: data.email, passwordHash, role, emailVerificationRequired: role === "CUSTOMER",
        ...(role === "CUSTOMER" ? { customer: { create: { name: data.name, email: data.email } } } : {}),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AuthError("An account with this email already exists", 409);
    }
    throw error;
  }
}

// A real bcrypt hash makes unknown-account login do the same expensive comparison.
// Precomputed cost-12 bcrypt hash; importing a module must not start expensive background work.
const dummyHash = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export async function authenticate(input: unknown, source: string) {
  const { email, password } = loginSchema.parse(input);
  await limitAuthAttempt("login", email, source);
  const user = await db.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid) throw new AuthError("Email or password is incorrect", 401);
  if (needsEmailVerification(user)) throw new AuthError("Verify your email before signing in. Use the verification link or request a new one", 403);
  await clearAuthAttempts("login", email, source);
  return user;
}

export function publicUser(user: { id: number; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
