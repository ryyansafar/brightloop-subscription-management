// All of the customer's issued invoices: status chips, search by number, paging.
import type { Metadata } from "next";
import { PageHeader, pageParam, param, type Params } from "@/components";
import { InvoiceTable } from "../InvoiceTable";
import { isPortalFilter } from "../logic";
import { NoAccount } from "../NoAccount";
import { PORTAL_PAGE_SIZE, listPortalInvoices } from "../queries";
import { getPortalScope } from "../scope";

export const metadata: Metadata = { title: "My invoices" };

export default async function PortalInvoicesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const scope = await getPortalScope();
  if (!scope.linked) return <NoAccount name={scope.displayName} />;
  const params = await searchParams;
  const filter = param(params, "filter");
  const page = pageParam(params);
  const { rows, total } = await listPortalInvoices(scope.customerId, {
    filter: isPortalFilter(filter) ? filter : undefined,
    q: param(params, "q"),
    page,
    today: scope.today,
  });

  return (
    <>
      <PageHeader title="My invoices" description={`${total.toLocaleString("en-IN")} invoices`} />
      <div className="p-4 md:p-6">
        <InvoiceTable
          rows={rows}
          today={scope.today}
          searchParams={params}
          filters={[
            {
              param: "filter",
              options: [
                { label: "Outstanding", value: "outstanding" },
                { label: "Overdue", value: "overdue" },
                { label: "Paid", value: "paid" },
              ],
            },
          ]}
          search={{ placeholder: "Invoice number" }}
          pagination={{ page, pageSize: PORTAL_PAGE_SIZE, total }}
          emptyMessage="No invoices match these filters."
        />
      </div>
    </>
  );
}
