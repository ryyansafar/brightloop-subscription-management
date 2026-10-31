"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Button, Dialog, FormField, Input, useToast } from "@/components";
import { apiFetch } from "../client-api";
import { formatPaiseToRupees, parseRupeesToPaise, toRupeesInput } from "../helpers";

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

export function VariantManager({
  open,
  onClose,
  product,
  canWrite = true,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductWithVariants;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [variants, setVariants] = useState(product.variants);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVariants(product.variants);
  }, [product.variants]);

  async function handleAddVariant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite) return;
    const form = new FormData(e.currentTarget);
    const attribute = String(form.get("attribute") ?? "").trim();
    const value = String(form.get("value") ?? "").trim();
    const extraPriceStr = String(form.get("extraPrice") ?? "0");
    const extraPrice = parseRupeesToPaise(extraPriceStr);

    if (!attribute || !value) {
      setError("Attribute and value are required");
      return;
    }
    if (extraPrice === null) {
      setError("Enter a valid positive extra price in rupees");
      return;
    }

    setAdding(true);
    setError(null);
    const res = await apiFetch<any>(`/api/products/${product.id}/variants`, {
      method: "POST",
      body: { attribute, value, extraPrice },
    });
    setAdding(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setVariants((prev) => [...prev, res.data]);
    (e.target as HTMLFormElement).reset();
    toast.success(`Variant ${attribute}: ${value} added`);
    router.refresh();
  }

  async function handleUpdateVariant(variantId: number) {
    const extraPrice = parseRupeesToPaise(editPrice);
    if (extraPrice === null) {
      toast.error("Enter a valid extra price");
      return;
    }
    const res = await apiFetch<any>(`/api/products/${product.id}/variants/${variantId}`, {
      method: "PATCH",
      body: { extraPrice },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setVariants((prev) => prev.map((v) => (v.id === variantId ? { ...v, extraPrice } : v)));
    setEditingId(null);
    toast.success("Variant price updated");
    router.refresh();
  }

  async function handleDeleteVariant(variantId: number) {
    if (!canWrite || !confirm("Delete this variant option?")) return;
    const res = await apiFetch(`/api/products/${product.id}/variants/${variantId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setVariants((prev) => prev.filter((v) => v.id !== variantId));
    toast.success("Variant removed");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Variants for ${product.name}`} footer={<Button onClick={onClose}>Close</Button>}>
      <div className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="rounded-md border border-line divide-y divide-line overflow-hidden">
          {variants.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted">No variants configured for this product.</p>
          ) : (
            variants.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                {editingId === v.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium text-foreground">{v.attribute}: {v.value}</span>
                    <Input
                      className="w-28 h-8 text-xs"
                      defaultValue={toRupeesInput(v.extraPrice)}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="Extra ₹"
                      inputMode="decimal"
                    />
                    <Button size="sm" variant="primary" onClick={() => handleUpdateVariant(v.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium text-foreground">{v.attribute}:</span> {v.value}
                      {v.extraPrice > 0 && (
                        <span className="ml-2 text-xs text-muted">(+{formatPaiseToRupees(v.extraPrice)})</span>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingId(v.id); setEditPrice(toRupeesInput(v.extraPrice)); }}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteVariant(v.id)}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {canWrite && (
          <form onSubmit={handleAddVariant} className="flex flex-col gap-3 rounded-md border border-line p-3 bg-surface-2">
            <h3 className="text-sm font-semibold text-foreground">Add new variant option</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FormField label="Attribute">
                {(f) => <Input {...f} name="attribute" placeholder="e.g. Brand, Size" required />}
              </FormField>
              <FormField label="Value">
                {(f) => <Input {...f} name="value" placeholder="e.g. Odoo, XL" required />}
              </FormField>
              <FormField label="Extra price (₹)">
                {(f) => <Input {...f} name="extraPrice" placeholder="0.00" inputMode="decimal" defaultValue="0" />}
              </FormField>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" loading={adding}>
                Add variant
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
