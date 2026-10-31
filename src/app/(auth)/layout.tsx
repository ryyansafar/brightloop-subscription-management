// Shell for the public auth pages: centred brand header, content, support line.
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid size-9 place-items-center rounded-md bg-primary text-base font-bold text-on-primary">
            B
          </span>
          <span className="text-xl font-semibold">Brightloop</span>
        </div>
        <p className="text-sm text-muted">Subscription management, invoiced on time.</p>
      </header>
      <main className="w-full max-w-md flex-1">{children}</main>
      <p className="mt-8 text-center text-sm text-muted">Need help? Contact your Brightloop administrator.</p>
    </div>
  );
}
