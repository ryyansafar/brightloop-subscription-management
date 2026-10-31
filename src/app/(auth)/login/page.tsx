import type { Metadata } from "next";
import { AuthScreen } from "../_components/AuthScreen";
export const metadata: Metadata = { title: "Sign in" };
export default function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <AuthScreen mode="login" searchParams={searchParams} />;
}
