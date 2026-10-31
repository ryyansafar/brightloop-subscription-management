import type { Metadata } from "next";
import { AuthScreen } from "../_components/AuthScreen";
export const metadata: Metadata = { title: "Reset your password" };
export default function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthScreen mode="forgot" searchParams={searchParams} />;
}
