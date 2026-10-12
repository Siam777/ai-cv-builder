"use client";
import type { ReactNode } from "react";
import { useModalFocus } from "@/lib/use-modal-focus";

export function PanelDialog({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const ref = useModalFocus(onClose);
  return (
    <div
      className="modal-backdrop no-print"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <section className="modal-card">
        <div className="modal-body account-dialog-body">{children}</div>
        <footer className="modal-footer">
          <button type="button" onClick={onClose}>
            Return to editor
          </button>
        </footer>
      </section>
    </div>
  );
}
