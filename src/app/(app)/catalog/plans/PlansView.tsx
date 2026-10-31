"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@prisma/client";
import { Badge, Button, DataTable, PageHeader, humanize, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
import { formatDate, formatPaiseToRupees } from "../helpers";
import { PlanDialog } from "./PlanDialog";

export function PlansView({
  plans,
  total,
  searchParams,
  canWrite,
}: {
  plans: Plan[];
  total: number;
  searchParams: Params;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; item: Plan | null }>({ open: false, item: null });

  async function handleArchive(plan: Plan) {
    if (!confirm(`Archive plan "${plan.name}"?`)) return;
    const res = await apiFetch(`/api/plans/${plan.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.error);
    toast.success(`Archived ${plan.name}`);
    router.refresh();
  }

  const columns: Column<Plan>[] = [
    { key: "name", header: "Plan Name" },
    { key: "price", header: "Price", align: "right", render: (p) => formatPaiseToRupees(p.price) },
    {
      key: "period",
      header: "Billing Period",
      render: (p) => `Every ${p.periodCount > 1 ? `${p.periodCount} ` : ""}${humanize(p.periodUnit).toLowerCase()}`,
    },
    { key: "minQuantity", header: "Min Qty", align: "right", hideOnMobile: true },
    {
      key: "availability",
      header: "Availability",
      hideOnMobile: true,
      render: (p) =>
        p.availableFrom || p.availableTo
          ? `${p.availableFrom ? formatDate(p.availableFrom) : "Open"} – ${p.availableTo ? formatDate(p.availableTo) : "Open"}`
          : "Anytime",
    },
    {
      key: "flags",
      header: "Flags",
      hideOnMobile: true,
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.renewable && <span className="text-[10px] bg-surface-2 px-1 rounded">Renewable</span>}
          {p.pausable && <span className="text-[10px] bg-surface-2 px-1 rounded">Pausable</span>}
          {p.closable && <span className="text-[10px] bg-surface-2 px-1 rounded">Closable</span>}
          {p.autoClose && <span className="text-[10px] bg-warning-soft text-warning px-1 rounded">Auto-close</span>}
        </div>
      ),
    },
    {
      key: "active",
      header: "Status",
      render: (p) => <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Archived"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: p })}>
            {canWrite ? "Edit" : "View"}
          </Button>
          {canWrite && p.active && (
            <Button size="sm" variant="danger" onClick={() => handleArchive(p)}>
              Archive
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Subscription Plans"
        breadcrumbs={[{ label: "Catalog", href: "/catalog/products" }]}
        description={`${total.toLocaleString("en-IN")} plans configured`}
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setDialog({ open: true, item: null })}>
              New plan
            </Button>
          )
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        <CatalogSubNav />
        <DataTable
          columns={columns}
          rows={plans}
          rowKey={(p) => p.id}
          basePath="/catalog/plans"
          searchParams={searchParams}
          filters={[
            {
              param: "periodUnit",
              options: [
                { label: "Daily", value: "DAY" },
                { label: "Weekly", value: "WEEK" },
                { label: "Monthly", value: "MONTH" },
                { label: "Yearly", value: "YEAR" },
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
          search={{ placeholder: "Search plans by name…" }}
          pagination={{ page: Number(searchParams.page) || 1, pageSize: 20, total }}
          emptyMessage="No plans match these filters."
        />
      </div>
      <PlanDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, item: null })}
        plan={dialog.item}
        canWrite={canWrite}
      />
    </>
  );
}
