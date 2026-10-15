"use client";

import type { MouseEvent } from "react";
import {
  CircleHelp,
  CreditCard,
  FolderOpen,
  Keyboard,
  LogIn,
  LogOut,
  Settings,
  Star,
  UserRound,
} from "lucide-react";
import type { AccountUser } from "@/lib/cloud-contract";
import { Menu, type MenuItem } from "./Menu";
import type { SaveState } from "./types";

export interface EditorHeaderProps {
  libraryMode?: boolean;
  /** Title of the page heading shown in library mode. */
  heading?: string;
  cloudUser: AccountUser | null;
  sessionUser: AccountUser | null;
  status: SaveState;
  busy: boolean;
  ready: boolean;
  showAccount: boolean;
  onOpenAccount: () => void;
  onUseAccount?: () => void;
  onOpenLibrary?: () => void;
  onOpenPricing?: () => void;
  onOpenShortcuts?: () => void;
  onSignOut?: () => void;
  isSubscriber?: boolean;
  onNavigate?: (href: string) => void;
}

export function EditorHeader({
  libraryMode = false,
  heading = "My CVs",
  cloudUser,
  sessionUser,
  status,
  busy,
  ready,
  showAccount,
  onOpenAccount,
  onUseAccount,
  onOpenLibrary,
  onOpenPricing,
  onOpenShortcuts,
  onSignOut,
  isSubscriber = false,
  onNavigate,
}: EditorHeaderProps) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (!onNavigate || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!busy && ready) onNavigate(event.currentTarget.getAttribute("href")!);
  }
  const go = (href: string) => () => {
    if (onNavigate) onNavigate(href);
    else window.location.assign(href);
  };
  const initial = sessionUser
    ? (sessionUser.name?.trim() || sessionUser.email).charAt(0).toUpperCase()
    : null;

  const accountItems: MenuItem[] = [
    ...(onOpenLibrary
      ? [{ label: "My CVs", icon: <FolderOpen size={16} aria-hidden />, onSelect: onOpenLibrary }]
      : []),
    sessionUser
      ? { label: "Account settings", icon: <Settings size={16} aria-hidden />, onSelect: onOpenAccount }
      : { label: "Sign in", hint: "Back up your CVs", icon: <LogIn size={16} aria-hidden />, onSelect: onOpenAccount },
    {
      label: "Plans & billing",
      icon: <CreditCard size={16} aria-hidden />,
      onSelect: onOpenPricing ?? go("/upgrade"),
    },
    ...(onOpenShortcuts
      ? [{ label: "Keyboard shortcuts", hint: "Press ?", icon: <Keyboard size={16} aria-hidden />, onSelect: onOpenShortcuts }]
      : []),
    { label: "Help", icon: <CircleHelp size={16} aria-hidden />, onSelect: go("/help") },
    ...(sessionUser && onSignOut
      ? [{ label: "Sign out", icon: <LogOut size={16} aria-hidden />, onSelect: onSignOut, separated: true }]
      : []),
  ];

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
            <button type="button" disabled={busy || !ready} onClick={onOpenLibrary}>
              My CVs
            </button>
          )}
          <a href="/templates" onClick={navigate} className="header-nav-link">
            Templates
          </a>
          <a href="/upgrade" onClick={navigate} className="header-nav-link">
            Pricing
          </a>
        </nav>
        <div className="header-right">
          {onOpenPricing && !isSubscriber && (
            <button
              type="button"
              className="pricing-pill"
              disabled={busy || !ready}
              onClick={onOpenPricing}
              title="Job Hunter Pass & Pricing"
            >
              <Star size={16} aria-hidden />
              Upgrade
            </button>
          )}
          <Menu
            ariaLabel="Account menu"
            className="account-menu"
            align="end"
            disabled={busy || !ready || showAccount}
            label={
              <span className={initial ? "avatar" : "avatar signed-out"} aria-hidden="true">
                {initial ?? <UserRound size={18} aria-hidden />}
              </span>
            }
            header={
              sessionUser ? (
                <>
                  <strong>{sessionUser.name?.trim() || "Signed in"}</strong>
                  <span>{sessionUser.email}</span>
                  {isSubscriber && <span className="menu-badge">Pass active</span>}
                </>
              ) : (
                <>
                  <strong>Not signed in</strong>
                  <span>Your CVs are saved in this browser.</span>
                </>
              )
            }
            items={accountItems}
          />
        </div>
      </header>
      {libraryMode && (
        <div className="workspace-heading no-print" style={{ display: showAccount ? "none" : undefined }}>
          <div>
            <h1>{heading}</h1>
            <p>
              {cloudUser?.email
                ? `Saved to your account · ${cloudUser.email}`
                : "Saved in this browser."}
            </p>
          </div>
          <div className="save-indicator">
            <div className="save-status" role="status" aria-live="polite">
              <span className={status === "Save failed" ? "dot failed" : "dot"} />
              {cloudUser && status === "Saved in this browser" ? "Saved to your account" : status}
            </div>
            {!cloudUser && status !== "Loading" &&
              (sessionUser && onUseAccount ? (
                <button type="button" className="save-indicator-action" disabled={busy || !ready} onClick={onUseAccount}>
                  Open my account CVs
                </button>
              ) : (
                !sessionUser && (
                  <button
                    type="button"
                    className="save-indicator-action"
                    disabled={busy || !ready || showAccount}
                    onClick={onOpenAccount}
                  >
                    Sign in to back up
                  </button>
                )
              ))}
          </div>
        </div>
      )}
    </>
  );
}
