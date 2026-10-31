"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Badge, Button, DataTable, PageHeader, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
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
  canWrite,
}: {
  discounts: DiscountWithProduct[];
  total: number;
  products: ProductOption[];
  searchParams: Params;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; item: DiscountWithProduct | null }>({
    open: false,
    item: null,
  });

  async function handleArchive(d: DiscountWithProduct) {
    if (!confirm(`Archive discount "${d.name}"?`)) return;
    const res = await apiFetch(`/api/discounts/${d.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.error);
    toast.success(`Archived ${d.name}`);
    router.refresh();
  }

  const columns: Column<DiscountWithProduct>[] = [
    { key: "name", header: "Discount Name" },
    {
      key: "value",
      header: "Benefit",
      render: (d) => (d.kind === "PERCENT" ? `${formatBpsToPercent(d.value)} off` : `${formatPaiseToRupees(d.value)} off`),
    },
    {
      key: "scope",
      header: "Scope",
      render: (d) => (d.scope === "PRODUCT" ? `Product: ${d.product?.name ?? "—"}` : "Subscription"),
    },
    {
      key: "period",
      header: "Valid Period",
      hideOnMobile: true,
      render: (d) => `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`,
    },
    {
      key: "usage",
      header: "Usage",
      hideOnMobile: true,
      render: (d) => `${d.usedCount} / ${d.usageLimit != null ? d.usageLimit : "∞"}`,
    },
    {
      key: "active",
      header: "Status",
      render: (d) => <Badge tone={d.active ? "success" : "neutral"}>{d.active ? "Active" : "Archived"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) =>
        canWrite ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: d })}>
              Edit
            </Button>
            {d.active && (
              <Button size="sm" variant="danger" onClick={() => handleArchive(d)}>
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
        description={`${total.toLocaleString("en-IN")} rules (Admin managed · billing engine applies)`}
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
              ],
            },
            {
              param: "active",
              options: [
                { label: "Active", value: "1" },
                { label: "Archived", value: "0" },
              ],
            },
          ]}
          pagination={{ page: Number(searchParams.page) || 1, pageSize: 20, total }}
          emptyMessage="No discounts match these filters."
        />
      </div>
      <DiscountDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, item: null })}
        discount={dialog.item}
        products={products}
      />
    </>
  );
}
