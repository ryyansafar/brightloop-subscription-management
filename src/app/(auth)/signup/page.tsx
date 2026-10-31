import { redirect } from "next/navigation";

// /signup is a public path in the proxy; the form lives on the Create account tab.
export default function SignupPage() {
  redirect("/login?tab=signup");
}
