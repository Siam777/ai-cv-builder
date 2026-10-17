"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

const SHEET_QUERY = "(max-width: 900px)";

/** True when side panels show as bottom sheets (narrow screens). */
export function useSheetLayout() {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const query = matchMedia(SHEET_QUERY);
    const sync = () => setSheet(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return sheet;
}

/**
 * Design, Check and AI open here. On wide screens the panel takes the
 * preview's place and the form stays usable; on narrow screens it is a
 * bottom sheet that keeps focus until it is closed.
 */
export function SidePanel({
  title,
  label,
  onClose,
  children,
  actions,
}: {
  title: string;
  /** Accessible name; defaults to the title. */
  label?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const sheet = useSheetLayout();
  const ref = useModalFocus<HTMLElement>(onClose, sheet);
  useBodyScrollLock(sheet);
  return (
    <>
      {sheet && (
        <div className="side-panel-backdrop no-print" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        id="side-panel"
        ref={ref}
        tabIndex={-1}
        className={sheet ? "side-panel sheet no-print" : "side-panel no-print"}
        role={sheet ? "dialog" : "complementary"}
        aria-modal={sheet || undefined}
        aria-label={label ?? title}
      >
        <header className="side-panel-header">
          <h2>{title}</h2>
          {actions}
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="side-panel-body">{children}</div>
      </aside>
    </>
  );
}
