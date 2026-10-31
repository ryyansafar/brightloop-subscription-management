"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/components/postJson";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    const result = await postJson("/api/auth/logout");
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    setBusy(false);
    router.replace("/login");
    router.refresh();
  }
  return <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" loading={busy} onClick={logout}>Sign out</Button>
    {error && <span role="alert" className="text-xs text-danger">{error}</span>}
  </div>;
}
