"use client";

import type { ResumeDocument } from "@/lib/document";
import type { AccountUser } from "@/lib/cloud-contract";
import type { SaveState } from "./types";

export interface EditorHeaderProps {
  doc: ResumeDocument | null;
  cloudUser: AccountUser | null;
  status: SaveState;
  busy: boolean;
  ready: boolean;
  showAccount: boolean;
  showAI: boolean;
  onOpenAccount: () => void;
  onOpenAts?: () => void;
  onOpenPricing?: () => void;
  onOpenShortcuts?: () => void;
  isSubscriber?: boolean;
}

import { lintResumeDocument } from "@/lib/linter/ats-linter";

export function EditorHeader({
  doc,
  cloudUser,
  status,
  busy,
  ready,
  showAccount,
  showAI,
  onOpenAccount,
  onOpenAts,
  onOpenPricing,
  onOpenShortcuts,
  isSubscriber = false,
}: EditorHeaderProps) {
  const atsScore = doc ? lintResumeDocument(doc).score : null;

  return (
    <>
      <header className="app-header no-print">
        <a className="brand" href="/" aria-label="AI CV Builder home">
          <span className="brand-mark">
            cv<span>·</span>
          </span>
          <span>
            Resume studio<small>AI CV BUILDER</small>
          </span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="/profile" className="header-nav-link" title="Open Profile & Account Page">
            Profile
          </a>
          <a href="/upgrade" className="header-nav-link" title="Open Plans & Pricing Page">
            Pricing
          </a>
          <a href="/grader" className="header-nav-link" title="Open Free ATS Resume Grader">
            ATS Grader
          </a>
        </nav>
        <div className="header-right">
          {doc && onOpenAts && (
            <button
              type="button"
              className="ats-score-pill"
              onClick={onOpenAts}
              title="Click to view ATS Readiness, Role Benchmark & Skill Gaps"
            >
              ⚡ {atsScore}% ATS & Role Fit
            </button>
          )}
          {onOpenPricing && (
            <button
              type="button"
              className={`pricing-pill${isSubscriber ? " active-pass" : ""}`}
              disabled={busy || !ready}
              onClick={onOpenPricing}
              title={isSubscriber ? "Job Hunter Pass Active · View Subscription" : "Job Hunter Pass & Pricing"}
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
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h1>A little clarity. A stronger resume.</h1>
          <p>Bring your experience together, one detail at a time.</p>
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
