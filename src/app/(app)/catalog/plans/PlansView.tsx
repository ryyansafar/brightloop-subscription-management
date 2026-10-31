"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@prisma/client";
import { Badge, Button, DataTable, MobileMeta, PageHeader, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
import { ConfirmDialog } from "../ConfirmDialog";
import { billingPeriodLabel, planFlagSummary } from "../derived";
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

  const [pendingArchive, setPendingArchive] = useState<Plan | null>(null);
  const [archiving, setArchiving] = useState(false);

  async function confirmArchive() {
    if (!pendingArchive) return;
    setArchiving(true);
    const res = await apiFetch(`/api/plans/${pendingArchive.id}`, { method: "DELETE" });
    setArchiving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Archived ${pendingArchive.name}`);
    setPendingArchive(null);
    router.refresh();
  }

  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: "Plan name",
      render: (p) => (
        <>
          {p.name}
          <MobileMeta below="lg">
            {billingPeriodLabel(p.periodCount, p.periodUnit)} · {p.active ? "Active" : "Archived"}
          </MobileMeta>
        </>
      ),
    },
    { key: "price", header: "Price", align: "right", render: (p) => formatPaiseToRupees(p.price) },
    {
      key: "period",
      header: "Billing period",
      hideBelow: "lg",
      render: (p) => billingPeriodLabel(p.periodCount, p.periodUnit),
    },
    { key: "minQuantity", header: "Min qty", align: "right", hideBelow: "xl" },
    {
      key: "availability",
      header: "Availability",
      hideBelow: "xl",
      render: (p) =>
        p.availableFrom || p.availableTo
          ? `${p.availableFrom ? formatDate(p.availableFrom) : "Open"} – ${p.availableTo ? formatDate(p.availableTo) : "Open"}`
          : "Anytime",
    },
    {
      key: "flags",
      header: "Flags",
      hideBelow: "xl",
      render: (p) => {
        const flags = planFlagSummary(p);
        return (
          <span title={flags.full} aria-label={flags.full} className="whitespace-nowrap text-xs text-muted">
            {flags.text}
          </span>
        );
      },
    },
    {
      key: "active",
      header: "Status",
      hideBelow: "lg",
      render: (p) => <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Archived"}</Badge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      pinRight: true,
      render: (p) => (
        <div className="flex justify-end gap-1 whitespace-nowrap">
          <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: p })}>
            {canWrite ? "Edit" : "View"}
          </Button>
          {canWrite && p.active && (
            <Button size="sm" variant="danger" onClick={() => setPendingArchive(p)}>
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
      <ConfirmDialog
        open={pendingArchive !== null}
        title="Archive plan"
        confirmLabel="Archive plan"
        busy={archiving}
        onConfirm={confirmArchive}
        onClose={() => setPendingArchive(null)}
      >
        Archive plan &ldquo;{pendingArchive?.name}&rdquo;? Existing subscriptions keep running on it.
      </ConfirmDialog>
    </>
  );
}
