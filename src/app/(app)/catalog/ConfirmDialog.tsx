"use client";

import type { ReactNode } from "react";
import { Button, Dialog } from "@/components";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Explains the consequence of the action. */
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Styled replacement for window.confirm on destructive catalog actions. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy = false, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{children}</div>
    </Dialog>
  );
}
