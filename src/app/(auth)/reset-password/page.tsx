import type { Metadata } from "next";
import { AuthScreen } from "../_components/AuthScreen";
export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };
export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthScreen mode="reset" searchParams={searchParams} />;
}
