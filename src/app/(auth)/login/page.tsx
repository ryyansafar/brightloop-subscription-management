import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "../_components/LoginView";
import { safeNext } from "../_lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

async function LoginContent({ searchParams }: { searchParams: Promise<{ next?: string | string[]; tab?: string | string[] }> }) {
  const params = await searchParams;
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  const tab = params.tab === "signup" ? "signup" : "signin";
  return <LoginView next={next} initialTab={tab} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; tab?: string | string[] }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border border-line bg-surface" aria-busy />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
