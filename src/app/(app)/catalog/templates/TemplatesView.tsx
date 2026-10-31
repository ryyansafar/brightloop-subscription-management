"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Button, DataTable, PageHeader, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
import { ConfirmDialog } from "../ConfirmDialog";
import { TemplateDialog } from "./TemplateDialog";

type TemplateView = Prisma.QuoteTemplateGetPayload<{
  include: { plan: { select: { id: true; name: true } }; lines: true };
}>;

interface PlanOption {
  id: number;
  name: string;
}

interface ProductOption {
  id: number;
  name: string;
  variants: { id: number; attribute: string; value: string }[];
}

export function TemplatesView({
  templates,
  total,
  plans,
  products,
  searchParams,
  canWrite,
}: {
  templates: TemplateView[];
  total: number;
  plans: PlanOption[];
  products: ProductOption[];
  searchParams: Params;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  // `nonce` changes on every open so the dialog remounts with fresh form and line state.
  const [dialog, setDialog] = useState<{ open: boolean; item: TemplateView | null; nonce: number }>({
    open: false,
    item: null,
    nonce: 0,
  });
  const [pendingDelete, setPendingDelete] = useState<TemplateView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDialog = (item: TemplateView | null) => setDialog((d) => ({ open: true, item, nonce: d.nonce + 1 }));
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await apiFetch(`/api/templates/${pendingDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(`Deleted ${pendingDelete.name}`);
    setPendingDelete(null);
    router.refresh();
  }

  const columns: Column<TemplateView>[] = [
    { key: "name", header: "Template Name" },
    { key: "plan", header: "Plan", render: (t) => t.plan.name },
    { key: "validityDays", header: "Validity", render: (t) => `${t.validityDays} days` },
    { key: "lines", header: "Line Items", render: (t) => `${t.lines.length} products` },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openDialog(t)}>
            {canWrite ? "Edit" : "View"}
          </Button>
          {canWrite && (
            <Button size="sm" variant="danger" onClick={() => setPendingDelete(t)}>
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quotation Templates"
        breadcrumbs={[{ label: "Catalog", href: "/catalog/products" }]}
        description={`${total.toLocaleString("en-IN")} templates configured`}
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => openDialog(null)}>
              New template
            </Button>
          )
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        <CatalogSubNav />
        <DataTable
          columns={columns}
          rows={templates}
          rowKey={(t) => t.id}
          basePath="/catalog/templates"
          searchParams={searchParams}
          search={{ placeholder: "Search templates by name…" }}
          pagination={{ page: Number(searchParams.page) || 1, pageSize: 20, total }}
          emptyMessage="No quotation templates configured yet."
        />
      </div>
      <TemplateDialog
        key={`${dialog.item?.id ?? "new"}-${dialog.nonce}`}
        open={dialog.open}
        onClose={closeDialog}
        template={dialog.item}
        plans={plans}
        products={products}
        canWrite={canWrite}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete template"
        confirmLabel="Delete template"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      >
        Delete template &ldquo;{pendingDelete?.name}&rdquo;? Subscriptions created from it keep their lines.
      </ConfirmDialog>
    </>
  );
}
