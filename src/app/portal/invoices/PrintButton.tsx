"use client";
import { Button } from "@/components";
export function PrintButton() { return <Button size="sm" onClick={() => window.print()}>Print invoice</Button>; }
