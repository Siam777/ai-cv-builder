"use client";

import { useEffect, useRef } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  useBodyScrollLock(true);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Simple focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-card shortcuts-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">PRODUCTIVITY SHORTCUTS</p>
            <h2 id="shortcuts-modal-title">Keyboard Navigation & Actions</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
          >
            ×
          </button>
        </div>

        <div className="shortcuts-content">
          <section className="shortcuts-group">
            <h3>Bullet List Flow</h3>
            <div className="shortcut-row">
              <span className="shortcut-action">Insert bullet below</span>
              <kbd className="key-combo">Enter</kbd>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Delete empty bullet and focus previous</span>
              <kbd className="key-combo">Backspace</kbd>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Move bullet up / down</span>
              <div className="key-combo-group">
                <kbd className="key-combo">Alt</kbd> + <kbd className="key-combo">↑</kbd> / <kbd className="key-combo">↓</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Navigate across bullet boundaries</span>
              <div className="key-combo-group">
                <kbd className="key-combo">↑</kbd> / <kbd className="key-combo">↓</kbd>
              </div>
            </div>
          </section>

          <section className="shortcuts-group">
            <h3>Inline AI Magic Bar & Diffs</h3>
            <div className="shortcut-row">
              <span className="shortcut-action">Accept proposed rewrite</span>
              <kbd className="key-combo">Tab</kbd>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Dismiss proposed rewrite</span>
              <kbd className="key-combo">Esc</kbd>
            </div>
          </section>

          <section className="shortcuts-group">
            <h3>Interactive Preview & Sync</h3>
            <div className="shortcut-row">
              <span className="shortcut-action">Bidirectional jump to editor field</span>
              <span className="shortcut-desc">Click any block in preview</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Zoom in / Zoom out</span>
              <div className="key-combo-group">
                <kbd className="key-combo">+</kbd> / <kbd className="key-combo">−</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Fit preview to width</span>
              <span className="shortcut-desc">Click &quot;Fit&quot; button</span>
            </div>
          </section>

          <section className="shortcuts-group">
            <h3>Studio & Session</h3>
            <div className="shortcut-row">
              <span className="shortcut-action">Session Undo</span>
              <div className="key-combo-group">
                <kbd className="key-combo">Ctrl</kbd> + <kbd className="key-combo">Z</kbd> / <kbd className="key-combo">⌘</kbd> + <kbd className="key-combo">Z</kbd>
              </div>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Toggle keyboard shortcuts</span>
              <kbd className="key-combo">?</kbd>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-action">Close active dialog or menu</span>
              <kbd className="key-combo">Esc</kbd>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button type="button" className="primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
