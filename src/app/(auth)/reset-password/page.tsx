import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "../_components/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

async function ResetContent({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={Array.isArray(token) ? (token[0] ?? null) : (token ?? null)} />;
}

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-lg border border-line bg-surface" aria-busy />}>
      <ResetContent searchParams={searchParams} />
    </Suspense>
  );
}
