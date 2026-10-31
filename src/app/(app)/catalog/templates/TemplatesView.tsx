"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Button, DataTable, PageHeader, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
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
  const [dialog, setDialog] = useState<{ open: boolean; item: TemplateView | null }>({ open: false, item: null });

  async function handleDelete(template: TemplateView) {
    if (!confirm(`Delete template "${template.name}"? Subscriptions will retain their lines.`)) return;
    const res = await apiFetch(`/api/templates/${template.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.error);
    toast.success(`Deleted ${template.name}`);
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
          <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, item: t })}>
            {canWrite ? "Edit" : "View"}
          </Button>
          {canWrite && (
            <Button size="sm" variant="danger" onClick={() => handleDelete(t)}>
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
            <Button variant="primary" onClick={() => setDialog({ open: true, item: null })}>
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
        open={dialog.open}
        onClose={() => setDialog({ open: false, item: null })}
        template={dialog.item}
        plans={plans}
        products={products}
        canWrite={canWrite}
      />
    </>
  );
}
