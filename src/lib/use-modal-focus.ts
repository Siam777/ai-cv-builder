"use client";

import { useEffect, useRef } from "react";

const openDialogs: HTMLElement[] = [];
let lastWorkspaceFocus: HTMLElement | null = null;

/** Remember the launcher before React makes its workspace inert. */
export function rememberWorkspaceFocus(target: HTMLElement) {
  lastWorkspaceFocus = target;
}

/** Keep keyboard focus in the top dialog, then return to its launching control. */
export function useModalFocus<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  active = true,
) {
  const ref = useRef<T>(null);
  const opener = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!active || !dialog) return;
    const focused = document.activeElement as HTMLElement | null;
    // React development mode replays effects while focus is already in this dialog.
    if (focused && focused !== document.body && !dialog.contains(focused)) opener.current = focused;
    if (!opener.current) opener.current = lastWorkspaceFocus;
    const previous = opener.current;
    openDialogs.push(dialog);
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, a[href], input, select, textarea, summary, [tabindex]",
        ),
      ).filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.matches(":disabled") &&
          !el.closest("[inert]") &&
          !el.closest('[aria-hidden="true"]') &&
          getComputedStyle(el).visibility !== "hidden" &&
          el.getClientRects().length > 0,
      );
    const focusFirst = () => (controls()[0] || dialog).focus();
    focusFirst();

    function keydown(event: KeyboardEvent) {
      if (openDialogs.at(-1) !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0],
        last = items.at(-1);
      if (
        !first ||
        (event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last || dialog : first || dialog).focus();
      }
    }
    function focusin(event: FocusEvent) {
      if (
        openDialogs.at(-1) === dialog &&
        !dialog.contains(event.target as Node)
      )
        focusFirst();
    }
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      // The workspace may become inert or disappear when another panel opens.
      requestAnimationFrame(() => {
        if (
          previous?.isConnected &&
          (!openDialogs.length || openDialogs.at(-1)?.contains(previous)) &&
          !previous.closest("[inert]") &&
          !previous.matches(":disabled")
        )
          previous.focus();
      });
    };
  }, [active]);
  return ref;
}
