import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { devMailerEnabled } from "@/lib/auth/config";
import { loginDestination } from "@/lib/auth/navigation";
import { AuthForm, type AuthMode } from "./AuthForm";

type PublicMode = Exclude<AuthMode, "staff">;
type Search = Promise<Record<string, string | string[] | undefined>>;
const copy: Record<PublicMode, { title: string; description: string }> = {
  login: { title: "Welcome back", description: "Sign in to manage your subscriptions, billing and growth." },
  signup: { title: "A simpler way to subscribe", description: "Create your account and keep everything in one place." },
  forgot: { title: "Forgot your password?", description: "Enter your email and we’ll help you get back to your account." },
  reset: { title: "Choose a new password", description: "Make it a strong one. You’ll sign in again after updating it." },
};

async function Content({ mode, searchParams }: { mode: PublicMode; searchParams: Search }) {
  await connection();
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  if (mode === "login" || mode === "signup") {
    const user = await getCurrentUser();
    if (user) redirect(loginDestination(next, user.role));
  }
  return <AuthForm mode={mode} next={next} token={typeof params.token === "string" ? params.token : undefined} recoveryAvailable={mode !== "forgot" || devMailerEnabled()} />;
}

export function AuthScreen({ mode, searchParams }: { mode: PublicMode; searchParams: Search }) {
  return <main className="min-h-screen bg-background lg:grid lg:grid-cols-2">
    <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-primary-soft p-12 lg:flex xl:p-16">
      <Link href="/login" className="flex w-fit items-center gap-3 text-xl font-semibold text-foreground"><span className="grid size-10 place-items-center rounded-xl bg-primary text-on-primary">B</span>Brightloop</Link>
      <div className="relative z-10 max-w-md py-16"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Built for recurring relationships</p>
        <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">A clear view of every subscription.</h2>
        <p className="mt-6 text-base leading-relaxed text-muted">From the first quotation to the next renewal. Bring your customers, plans and billing together in one calm workspace.</p>
        <div className="mt-10 space-y-4 text-sm text-foreground">{["One connected subscription lifecycle", "Billing that stays in step with your business", "A dedicated space for every customer"].map((text) => <p key={text} className="flex gap-3"><span aria-hidden className="font-semibold text-primary">✓</span>{text}</p>)}</div>
      </div>
      <p className="text-xs text-muted">Brightloop · Subscription management, made clear.</p>
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-28 size-96 rounded-full border-[50px] border-primary/5" />
    </section>
    <section className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/login" className="mb-12 flex items-center gap-2 text-lg font-semibold lg:hidden"><span className="grid size-8 place-items-center rounded-lg bg-primary text-on-primary">B</span>Brightloop</Link>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Your Brightloop workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">{copy[mode].title}</h1>
        <p className="mb-8 mt-3 text-sm leading-relaxed text-muted">{copy[mode].description}</p>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-2" aria-label="Loading form" />}><Content mode={mode} searchParams={searchParams} /></Suspense>
      </div>
    </section>
  </main>;
}
