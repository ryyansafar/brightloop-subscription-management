"use client";
// Sidebar footer: who is signed in, their role, and Sign out.
import { useState } from "react";
import type { Role } from "@/lib/state";
import { Badge, humanize } from "../ui/Badge";
import { Button } from "../ui/Button";
import { postJson } from "../postJson";

interface UserMenuProps {
  name: string;
  role: Role;
}

export function UserMenu({ name, role }: UserMenuProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    const res = await postJson("/api/auth/logout");
    if (res.ok) {
      // Full navigation drops all client state belonging to the old session.
      window.location.assign(new URL("/login", window.location.origin).href);
      return;
    }
    setBusy(false);
    setFailed(true);
  }

  return (
    <div className="flex flex-col gap-2 border-t border-line px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-medium" title={name}>
          {name}
        </p>
        <Badge tone={role === "CUSTOMER" ? "neutral" : "primary"}>{humanize(role)}</Badge>
      </div>
      <Button variant="secondary" loading={busy} onClick={signOut} className="h-11 w-full md:h-10">
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      {failed && (
        <p role="alert" className="text-xs text-danger">
          Could not sign out. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
