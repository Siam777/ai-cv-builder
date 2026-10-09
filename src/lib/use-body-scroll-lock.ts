"use client";

import { useEffect } from "react";

let lockCount = 0;
let originalOverflow = "";

/**
 * Reference-counted hook to prevent body/background scrolling while any modal or overlay is active.
 * Restores original overflow style only when all active locks have unmounted or deactivated.
 */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");
    }
    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow;
        document.body.classList.remove("modal-open");
      }
    };
  }, [active]);
}
