"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Badge, Button, DataTable, PageHeader, humanize, type Column, type Params, useToast } from "@/components";
import { CatalogSubNav } from "../catalog-nav";
import { apiFetch } from "../client-api";
import { formatPaiseToRupees } from "../helpers";
import { ProductDialog } from "./ProductDialog";
import { VariantManager } from "./VariantManager";

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

export function ProductsView({
  products,
  total,
  searchParams,
  canWrite,
}: {
  products: ProductWithVariants[];
  total: number;
  searchParams: Params;
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [productDialog, setProductDialog] = useState<{ open: boolean; item: ProductWithVariants | null }>({
    open: false,
    item: null,
  });
  const [variantProduct, setVariantProduct] = useState<ProductWithVariants | null>(null);

  async function handleArchive(product: ProductWithVariants) {
    if (!confirm(`Archive product "${product.name}"? Existing subscriptions will be preserved.`)) return;
    const res = await apiFetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.error);
    toast.success(`Archived ${product.name}`);
    router.refresh();
  }

  const columns: Column<ProductWithVariants>[] = [
    { key: "name", header: "Product Name" },
    { key: "type", header: "Type", render: (p) => <Badge tone="info">{humanize(p.type)}</Badge> },
    { key: "salesPrice", header: "Sales Price", align: "right", render: (p) => formatPaiseToRupees(p.salesPrice) },
    { key: "costPrice", header: "Cost Price", align: "right", hideOnMobile: true, render: (p) => formatPaiseToRupees(p.costPrice) },
    {
      key: "variants",
      header: "Variants",
      render: (p) => (
        <button
          type="button"
          onClick={() => setVariantProduct(p)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {p.variants.length > 0 ? `${p.variants.length} options` : canWrite ? "+ Add variants" : "None"}
        </button>
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
          <Button size="sm" variant="ghost" onClick={() => setProductDialog({ open: true, item: p })}>
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
        title="Products"
        breadcrumbs={[{ label: "Catalog", href: "/catalog/products" }]}
        description={`${total.toLocaleString("en-IN")} products in catalog`}
        actions={
          canWrite && (
            <Button variant="primary" onClick={() => setProductDialog({ open: true, item: null })}>
              New product
            </Button>
          )
        }
      />
      <div className="p-4 md:p-6 space-y-4">
        <CatalogSubNav />
        <DataTable
          columns={columns}
          rows={products}
          rowKey={(p) => p.id}
          basePath="/catalog/products"
          searchParams={searchParams}
          filters={[
            {
              param: "type",
              options: [
                { label: "Software", value: "SOFTWARE" },
                { label: "Service", value: "SERVICE" },
                { label: "Addon", value: "ADDON" },
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
          search={{ placeholder: "Search products by name…" }}
          pagination={{ page: Number(searchParams.page) || 1, pageSize: 20, total }}
          emptyMessage="No products match your filters."
        />
      </div>

      <ProductDialog
        open={productDialog.open}
        onClose={() => setProductDialog({ open: false, item: null })}
        product={productDialog.item}
        canWrite={canWrite}
      />

      {variantProduct && (
        <VariantManager
          open={Boolean(variantProduct)}
          onClose={() => setVariantProduct(null)}
          product={variantProduct}
          canWrite={canWrite}
        />
      )}
    </>
  );
}
