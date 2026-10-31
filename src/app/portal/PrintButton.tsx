"use client";
import { Button } from "@/components";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button className="min-h-11 md:min-h-8" size="sm" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
