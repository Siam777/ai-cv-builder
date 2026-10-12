"use client";

import type { ResumeDocument } from "@/lib/document";
import type { AccountUser } from "@/lib/cloud-contract";
import type { SaveState } from "./types";
import type { MouseEvent } from "react";

export interface EditorHeaderProps {
  doc: ResumeDocument | null;
  libraryMode?: boolean;
  cloudUser: AccountUser | null;
  status: SaveState;
  busy: boolean;
  ready: boolean;
  showAccount: boolean;
  showAI: boolean;
  onOpenAccount: () => void;
  onOpenLibrary?: () => void;
  onOpenAts?: () => void;
  onOpenPricing?: () => void;
  onOpenShortcuts?: () => void;
  isSubscriber?: boolean;
  onNavigate?: (href: string) => void;
}

export function EditorHeader({
  doc,
  libraryMode = false,
  cloudUser,
  status,
  busy,
  ready,
  showAccount,
  showAI,
  onOpenAccount,
  onOpenLibrary,
  onOpenAts,
  onOpenPricing,
  onOpenShortcuts,
  isSubscriber = false,
  onNavigate,
}: EditorHeaderProps) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (!onNavigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!busy && ready) onNavigate(event.currentTarget.getAttribute("href")!);
  }
  return (
    <>
      <header className="app-header no-print">
        <a className="brand" href="/builder" onClick={navigate} aria-label="AI CV Builder library">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            AI CV Builder<small>Resume studio</small>
          </span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          {onOpenLibrary && (
            <button disabled={busy || !ready} onClick={onOpenLibrary}>
              {cloudUser ? "My CVs" : "On this device"}
            </button>
          )}
          <a
            href="/profile"
            onClick={navigate}
            className="header-nav-link"
            title="Open Profile & Account Page"
          >
            Profile
          </a>
          <a
            href="/upgrade"
            onClick={navigate}
            className="header-nav-link"
            title="Open Plans & Pricing Page"
          >
            Pricing
          </a>
          <a
            href="/grader"
            onClick={navigate}
            className="header-nav-link"
            title="Open resume content review"
          >
            Resume review
          </a>
        </nav>
        <div className="header-right">
          {onOpenLibrary && (
            <button
              className="header-library-shortcut"
              disabled={busy || !ready || showAccount || showAI}
              onClick={onOpenLibrary}
            >
              My library
            </button>
          )}
          {doc && !libraryMode && onOpenAts && (
            <button
              type="button"
              className="ats-score-pill"
              onClick={onOpenAts}
              title="Review writing findings and confirm a role checklist"
            >
              Review writing
            </button>
          )}
          {onOpenPricing && (
            <button
              type="button"
              className={`pricing-pill${isSubscriber ? " active-pass" : ""}`}
              disabled={busy || !ready}
              onClick={onOpenPricing}
              title={
                isSubscriber
                  ? "Job Hunter Pass Active · View Subscription"
                  : "Job Hunter Pass & Pricing"
              }
            >
              {isSubscriber ? "⭐ Pass Active" : "⭐ Upgrade"}
            </button>
          )}
          {onOpenShortcuts && (
            <button
              type="button"
              className="shortcuts-pill"
              disabled={busy || !ready}
              onClick={onOpenShortcuts}
              title="Keyboard Shortcuts (? or Ctrl+/)"
              aria-label="Keyboard shortcuts"
            >
              ⌨️
            </button>
          )}
          <button
            disabled={busy || !ready || showAccount || showAI}
            onClick={onOpenAccount}
          >
            Account
          </button>
          <span className="local-badge">
            <span /> {cloudUser ? "Account workspace" : "Local workspace"}
          </span>
          <span className="avatar" aria-hidden="true">
            {doc?.contact.name.charAt(0) || "Y"}
          </span>
        </div>
      </header>
      <div
        className="workspace-heading no-print"
        style={{ display: showAccount ? "none" : undefined }}
      >
        <div>
          <h1>
            {libraryMode
              ? "Your CVs, clearly organized."
              : doc?.name || "Import your experience."}
          </h1>
          <p>
            {libraryMode
              ? cloudUser?.email ||
                "Personal drafts on this device. Demo examples have their own gallery."
              : "Your details, your wording. Review the saved file before sending."}
          </p>
        </div>
        <div className="save-status" role="status" aria-live="polite">
          <span className={status === "Save failed" ? "dot failed" : "dot"} />
          {cloudUser && status === "Saved on this device"
            ? "Saved to your account"
            : status}
        </div>
      </div>
    </>
  );
}
