"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Badge, Button, DataTable, MobileMeta, PageHeader, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
import { ConfirmDialog } from "../ConfirmDialog";
import { discountStatus } from "../derived";
import { formatBpsToPercent, formatDate, formatPaiseToRupees } from "../helpers";
import { DiscountDialog } from "./DiscountDialog";

type DiscountWithProduct = Prisma.DiscountGetPayload<{ include: { product: { select: { id: true; name: true } } } }>;

interface ProductOption {
  id: number;
  name: string;
}

export function DiscountsView({
  discounts,
  total,
  products,
  searchParams,
  now,
  canWrite,
}: {
  discounts: DiscountWithProduct[];
  total: number;
  products: ProductOption[];
  searchParams: Params;
  /** Server time (ISO) so badges match what the billing engine will apply. */
  now: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; item: DiscountWithProduct | null }>({
    open: false,
    item: null,
  });

  const [pendingArchive, setPendingArchive] = useState<DiscountWithProduct | null>(null);
  const [archiving, setArchiving] = useState(false);
  const nowDate = new Date(now);

  async function confirmArchive() {
    if (!pendingArchive) return;
    setArchiving(true);
    const res = await apiFetch(`/api/discounts/${pendingArchive.id}`, { method: "DELETE" });
    setArchiving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Archived ${pendingArchive.name}`);
    setPendingArchive(null);
    router.refresh();
  }

  const columns: Column<DiscountWithProduct>[] = [
    {
      key: "name",
      header: "Discount name",
      render: (d) => (
        <>
          {d.name}
          <MobileMeta below="lg">{discountStatus(d, nowDate).label}</MobileMeta>
        </>
      ),
    },
    {
      key: "value",
      header: "Benefit",
      render: (d) => (d.kind === "PERCENT" ? `${formatBpsToPercent(d.value)} off` : `${formatPaiseToRupees(d.value)} off`),
    },
    {
      key: "scope",
      header: "Scope",
      hideBelow: "lg",
      render: (d) => (d.scope === "PRODUCT" ? `Product: ${d.product?.name ?? "—"}` : "Subscription"),
    },
    {
      key: "period",
      header: "Valid Period",
      hideBelow: "lg",
      render: (d) => `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`,
    },
    {
      key: "usage",
      header: "Usage",
      hideBelow: "xl",
      render: (d) => `${d.usedCount} / ${d.usageLimit != null ? d.usageLimit : "∞"}`,
    },
    {
      key: "active",
      header: "Status",
      hideBelow: "lg",
      render: (d) => {
        const status = discountStatus(d, nowDate);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      pinRight: true,
      render: (d) =>
        canWrite ? (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: d })}>
              Edit
            </Button>
            {d.active && (
              <Button size="sm" variant="danger" onClick={() => setPendingArchive(d)}>
                Archive
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Discounts"
        breadcrumbs={[{ label: "Catalog", href: "/catalog/products" }]}
        description={`${total.toLocaleString("en-IN")} rules · managed by admins, applied automatically at billing`}
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setDialog({ open: true, item: null })}>
              New discount
            </Button>
          )
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        <CatalogSubNav />
        {!canWrite && (
          <div className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
            Discounts are restricted to Administrators. You have view-only access.
          </div>
        )}
        <DataTable
          columns={columns}
          rows={discounts}
          rowKey={(d) => d.id}
          basePath="/catalog/discounts"
          searchParams={searchParams}
          filters={[
            {
              param: "state",
              options: [
                { label: "Running", value: "running" },
                { label: "Upcoming", value: "upcoming" },
                { label: "Expired", value: "expired" },
                { label: "Exhausted", value: "exhausted" },
              ],
            },
            {
              param: "active",
              options: [
                { label: "Active", value: "1" },
                { label: "Inactive", value: "0" },
              ],
            },
          ]}
          search={{ placeholder: "Search discounts by name…" }}
          pagination={{ page: Number(searchParams.page) || 1, pageSize: 20, total }}
          emptyMessage="No discounts match these filters."
        />
      </div>
      <DiscountDialog
        key={dialog.item?.id ?? "new"}
        open={dialog.open}
        onClose={() => setDialog({ open: false, item: null })}
        discount={dialog.item}
        products={products}
      />
      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive discount"
        confirmLabel="Archive discount"
        busy={archiving}
        onConfirm={confirmArchive}
        onClose={() => setPendingArchive(null)}
      >
        Archive discount &ldquo;{pendingArchive?.name}&rdquo;? It stops applying to new invoices.
      </ConfirmDialog>
    </>
  );
}
