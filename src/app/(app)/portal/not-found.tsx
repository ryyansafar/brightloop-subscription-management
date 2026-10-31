import { Button, PageHeader } from "@/components";

export default function PortalNotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <div className="p-4 md:p-6">
        <div className="rounded-lg border border-line bg-surface px-4 py-10 text-center">
          <p className="font-semibold">We could not find that page</p>
          <p className="mt-1 text-sm text-muted">It may not exist, or it is not part of your account.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button href="/portal" variant="primary" className="min-h-11">
              My subscriptions
            </Button>
            <Button href="/portal/invoices" className="min-h-11">
              My invoices
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
