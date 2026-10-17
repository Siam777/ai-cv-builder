"use client";

import { useState, type ReactNode, type Ref } from "react";
import { REWRITE_STATUS_TEXT, type RewriteStatus } from "@/lib/ai-access";
import type { FieldAiServices } from "./FieldAiContext";

/** Why an AI action cannot run yet, with the one step that fixes it. */
export function AiBlocked({
  status,
  services,
}: {
  status: RewriteStatus;
  services: FieldAiServices;
}) {
  return (
    <div className="field-ai-note">
      <p>{REWRITE_STATUS_TEXT[status]}</p>
      {(status === "account-needed" || status === "session-expired") && (
        <button type="button" className="primary" onClick={services.onOpenAccount}>
          Sign in to use AI
        </button>
      )}
      {status === "browser-cv" && (
        <button type="button" className="primary" onClick={services.onCopyToAccount}>
          Copy to my account
        </button>
      )}
    </div>
  );
}

/**
 * The one-time AI consent, kept on the account. Once it is on, AI views only
 * say what they send; it can be turned off in Account settings.
 */
export function AiConsent({
  sends,
  onAgreed,
  onCancel,
  services,
  primaryRef,
}: {
  /** What this action sends, in a sentence. */
  sends: ReactNode;
  onAgreed: () => void;
  onCancel: () => void;
  services: FieldAiServices;
  primaryRef?: Ref<HTMLButtonElement>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="field-ai-form ai-consent">
      <p>
        <strong>Use AI writing help?</strong> Your CV text and notes are sent to
        OpenAI; contact details are not. You review everything before it is
        added. You can turn this off in Account settings, Data &amp; privacy.
      </p>
      <p className="field-ai-help">{sends}</p>
      {error && (
        <p className="field-ai-error" role="alert">
          {error}
        </p>
      )}
      <div className="field-ai-actions">
        <button
          type="button"
          className="primary"
          ref={primaryRef}
          disabled={working}
          onClick={() => {
            setWorking(true);
            setError("");
            services
              .grantConsent()
              .then(onAgreed)
              .catch((e: Error) => setError(e.message))
              .finally(() => setWorking(false));
          }}
        >
          Turn on AI writing help
        </button>
        <button type="button" onClick={onCancel}>
          Not now
        </button>
      </div>
    </div>
  );
}
