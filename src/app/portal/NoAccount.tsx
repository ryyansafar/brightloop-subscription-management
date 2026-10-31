// Friendly empty state for a signed-in customer whose login has no linked Customer record.
import { PageHeader } from "@/components";

export function NoAccount({ name }: { name: string }) {
  return (
    <>
      <PageHeader title="My subscriptions" description={`Hello, ${name}.`} />
      <div className="p-4 md:p-6">
        <div className="rounded-lg border border-line bg-surface px-4 py-10 text-center">
          <h2 className="font-semibold">Your account is not set up yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            We could not find any subscriptions or invoices linked to this login. Please contact Brightloop support and
            we will connect your account.
          </p>
        </div>
      </div>
    </>
  );
}
