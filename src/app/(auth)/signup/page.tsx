import type { Metadata } from "next";
import { AuthScreen } from "../_components/AuthScreen";
export const metadata: Metadata = { title: "Create account" };
export default function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthScreen mode="signup" searchParams={searchParams} />;
}
