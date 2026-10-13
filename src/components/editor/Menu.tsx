"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  hint?: string;
  disabled?: boolean;
  /** Starts a new group with a divider above it. */
  separated?: boolean;
  current?: boolean;
  /** Extra class for styling or grouping this item. */
  className?: string;
}

/**
 * A button that opens a list of actions. Arrow keys move between items,
 * Escape or a click outside closes it, and focus returns to the button.
 */
export function Menu({
  label,
  ariaLabel,
  items,
  header,
  disabled,
  className = "",
  align = "start",
}: {
  label: ReactNode;
  ariaLabel?: string;
  items: MenuItem[];
  header?: ReactNode;
  disabled?: boolean;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = root.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    first?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close(restoreFocus: boolean) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }

  function move(step: number) {
    const options = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    const index = options.indexOf(document.activeElement as HTMLElement);
    options.at((index + step) % options.length)?.focus();
  }

  return (
    <div
      className={`menu ${className}`}
      ref={root}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "Tab") {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className="menu-trigger"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div
          id={id}
          className={`menu-list menu-${align}`}
          role="menu"
          aria-label={ariaLabel}
        >
          {header && <div className="menu-header">{header}</div>}
          {items.map((item, index) => (
            <button
              key={`${index}:${item.label}`}
              type="button"
              role="menuitem"
              className={[
                "menu-item",
                item.separated && "separated",
                item.className,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={item.current || undefined}
              disabled={item.disabled}
              onClick={() => {
                close(true);
                item.onSelect();
              }}
            >
              {item.icon}
              <span>
                {item.label}
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
