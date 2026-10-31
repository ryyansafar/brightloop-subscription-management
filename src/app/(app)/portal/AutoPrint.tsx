"use client";
import { useEffect } from "react";

/** Opens the browser print dialog once, for the "Print" link on the invoice list. */
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
