import { Prisma } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { AuthError, limitAuthAttempt } from "./security";
import { loginSchema, signupSchema } from "./validation";

export async function createAccount(input: unknown, role: "CUSTOMER" | "STAFF" = "CUSTOMER") {
  const data = signupSchema.parse(input);
  limitAuthAttempt("signup", data.email);
  const passwordHash = await hash(data.password, 12);
  try {
    return await db.user.create({
      data: {
        name: data.name, email: data.email, passwordHash, role,
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
const dummyHash = hash("Unusable!DummyPassword", 12);

export async function authenticate(input: unknown) {
  const { email, password } = loginSchema.parse(input);
  limitAuthAttempt("login", email);
  const user = await db.user.findUnique({ where: { email } });
  const valid = await compare(password, user?.passwordHash ?? await dummyHash);
  if (!user || !valid) throw new AuthError("Email or password is incorrect", 401);
  return user;
}

export function publicUser(user: { id: number; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
