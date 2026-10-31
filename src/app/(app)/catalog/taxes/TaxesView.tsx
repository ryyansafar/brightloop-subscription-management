"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaxRate } from "@prisma/client";
import { Badge, Button, DataTable, MobileMeta, PageHeader, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
import { formatBpsToPercent } from "../helpers";
import { TaxDialog } from "./TaxDialog";

export function TaxesView({
  taxes,
  total,
  searchParams,
  canWrite,
}: {
  taxes: TaxRate[];
  total: number;
  searchParams: Params;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; item: TaxRate | null }>({ open: false, item: null });

  async function handleArchive(tax: TaxRate) {
    if (!confirm(`Archive tax rate "${tax.name}"?`)) return;
    const res = await apiFetch(`/api/taxes/${tax.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.error);
    toast.success(`Archived ${tax.name}`);
    router.refresh();
  }

  const columns: Column<TaxRate>[] = [
    {
      key: "name",
      header: "Tax name",
      render: (t) => (
        <>
          {t.name}
          <MobileMeta below="lg">{t.active ? "Active" : "Archived"}</MobileMeta>
        </>
      ),
    },
    { key: "rateBps", header: "Rate", align: "right", render: (t) => formatBpsToPercent(t.rateBps) },
    {
      key: "active",
      header: "Status",
      hideBelow: "lg",
      render: (t) => <Badge tone={t.active ? "success" : "neutral"}>{t.active ? "Active" : "Archived"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      pinRight: true,
      render: (t) =>
        canWrite ? (
          <div className="flex justify-end gap-1 whitespace-nowrap">
            <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: t })}>
              Edit
            </Button>
            {t.active && (
              <Button size="sm" variant="danger" onClick={() => handleArchive(t)}>
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
        title="Tax Rates"
        breadcrumbs={[{ label: "Catalog", href: "/catalog/products" }]}
        description={`${total.toLocaleString("en-IN")} tax rates (Admin managed)`}
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setDialog({ open: true, item: null })}>
              New tax rate
            </Button>
          )
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        <CatalogSubNav />
        {!canWrite && (
          <div className="rounded-md bg-warning-soft px-4 py-3 text-sm text-warning">
            Tax rates are restricted to Administrators. You have view-only access.
          </div>
        )}
        <DataTable
          columns={columns}
          rows={taxes}
          rowKey={(t) => t.id}
          basePath="/catalog/taxes"
          searchParams={searchParams}
          filters={[
            {
              param: "active",
              options: [
                { label: "Active", value: "1" },
                { label: "Archived", value: "0" },
              ],
            },
          ]}
          pagination={{ page: Number(searchParams.page) || 1, pageSize: 20, total }}
          emptyMessage="No tax rates configured."
        />
      </div>
      <TaxDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, item: null })}
        tax={dialog.item}
        canWrite={canWrite}
      />
    </>
  );
}
