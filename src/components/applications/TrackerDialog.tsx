"use client";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

/** A modal used by the tracker: focus stays inside, Escape closes, focus returns to the opener. */
export function TrackerDialog({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useModalFocus(onClose);
  useBodyScrollLock(true);
  return (
    <div
      className="modal-backdrop no-print"
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section
        className={
          wide ? "modal-card tracker-dialog wide" : "modal-card tracker-dialog"
        }
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="modal-body tracker-dialog-body">{children}</div>
        {footer && (
          <footer className="modal-footer tracker-dialog-footer">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
