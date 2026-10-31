import type { Metadata } from "next";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VerificationForm } from "./VerificationForm";

export const metadata: Metadata = { title: "Verify email", referrer: "no-referrer" };
type Search = Promise<Record<string, string | string[] | undefined>>;
async function Content({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return <VerificationForm token={typeof params.token === "string" ? params.token : undefined} />;
}
export default function VerifyEmailPage({ searchParams }: { searchParams: Search }) {
  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
    <section className="w-full max-w-md space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div className="flex justify-end"><ThemeToggle /></div>
      <p className="text-sm font-semibold text-primary">Brightloop</p>
      <h1 className="text-3xl font-semibold">Verify your email</h1>
      <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}><Content searchParams={searchParams} /></Suspense>
    </section>
  </main>;
}
