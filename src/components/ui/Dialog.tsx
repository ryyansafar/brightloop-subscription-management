"use client";
// Owner: fathima. Modal built on the native <dialog> (focus trap and Esc for free).
// Locks page scroll while open, returns focus to the opener, and stacks footer buttons on phones.
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons for the bottom bar, e.g. Cancel + Save. */
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // Lock background scroll while open; restore whatever was there before.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Return focus to the control that opened the dialog once it has closed.
  useEffect(() => {
    if (open) return;
    const target = opener.current;
    opener.current = null;
    if (target?.isConnected) target.focus();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        // Esc: let the parent own the state so the dialog and `open` never disagree.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="no-print m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line py-1.5 pl-5 pr-2">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="grid size-10 shrink-0 place-items-center rounded-md text-xl leading-none text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-3 min-[480px]:flex-row min-[480px]:justify-end [&>*]:w-full min-[480px]:[&>*]:w-auto">
          {footer}
        </div>
      )}
    </dialog>
  );
}
