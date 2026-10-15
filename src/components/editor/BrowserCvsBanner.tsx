"use client";

import { useState } from "react";
import type { ResumeDocument } from "@/lib/document";
import { TransferList } from "../account-panel";

const key = (userId: string) => `cv-browser-cvs-banner:${userId}`;

/** Whether the one-time "copy browser CVs" banner was dismissed for this user. */
export function browserCvsBannerDismissed(userId: string) {
  try {
    return localStorage.getItem(key(userId)) === "dismissed";
  } catch {
    return false;
  }
}

function dismissBrowserCvsBanner(userId: string) {
  try {
    localStorage.setItem(key(userId), "dismissed");
  } catch {
    // Storage unavailable: the banner may show again next time.
  }
}

/**
 * In My CVs (and the start screen) for a signed-in user whose browser holds
 * CVs. The first time it offers to copy them to the account; after "Not now"
 * it stays as one line, so the browser CVs are always reachable.
 */
export function BrowserCvsBanner({
  userId,
  email,
  total,
  documents,
  busy,
  onCopy,
  onShow,
  onDone,
}: {
  userId: string;
  email: string;
  /** Every CV saved in this browser, including practice copies. */
  total: number;
  /** Browser CVs that can be copied: own CVs never copied before. */
  documents: ResumeDocument[];
  busy: boolean;
  onCopy: (documents: ResumeDocument[]) => Promise<void>;
  /** Switches this tab to the CVs saved in this browser. */
  onShow: () => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(
    () => !documents.length || browserCvsBannerDismissed(userId),
  );
  const [selected, setSelected] = useState(() => documents.map((doc) => doc.id));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const count = documents.length;
  function notNow() {
    dismissBrowserCvsBanner(userId);
    setCompact(true);
    setOpen(false);
  }
  const transfer = open && (
    <TransferList
      email={email}
      documents={documents}
      imported={[]}
      selected={selected}
      working={busy || working}
      onSelect={setSelected}
      onCancel={() => setOpen(false)}
      onCopy={() => {
        setWorking(true);
        setError("");
        void onCopy(documents.filter((doc) => selected.includes(doc.id)))
          .then(() => {
            dismissBrowserCvsBanner(userId);
            onDone();
          })
          .catch((e) => setError((e as Error).message))
          .finally(() => setWorking(false));
      }}
    />
  );
  const errorText = error && (
    <p className="account-error" role="alert">
      {error}
    </p>
  );
  if (compact)
    return (
      <section
        className="browser-cvs-banner compact no-print"
        aria-label="CVs saved in this browser"
      >
        <div className="browser-cvs-line">
          <p>
            {total} {total === 1 ? "CV is" : "CVs are"} saved in this browser, not in your account.
          </p>
          <div className="button-row">
            <button disabled={busy} onClick={onShow}>
              Show {total === 1 ? "it" : "them"}
            </button>
            {count > 0 && !open && (
              <button disabled={busy} onClick={() => setOpen(true)}>
                Copy to my account
              </button>
            )}
          </div>
        </div>
        {errorText}
        {transfer}
      </section>
    );
  return (
    <section className="browser-cvs-banner no-print" aria-label="CVs saved in this browser">
      <p>
        <strong>
          You have {count} {count === 1 ? "CV" : "CVs"} saved in this browser.
        </strong>{" "}
        Copy {count === 1 ? "it" : "them"} to your account to open {count === 1 ? "it" : "them"} on any device.
      </p>
      {errorText}
      {open ? (
        transfer
      ) : (
        <div className="button-row">
          <button className="primary" disabled={busy} onClick={() => setOpen(true)}>
            Copy to my account
          </button>
          <button disabled={busy} onClick={onShow}>
            Show {count === 1 ? "it" : "them"}
          </button>
          <button disabled={busy} onClick={notNow}>
            Not now
          </button>
        </div>
      )}
    </section>
  );
}
