"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ImproveAllCv } from "./editor/ImproveAll";
import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import type { ResumeDocument } from "@/lib/document";
import { helpMeFinish, type HelpItem } from "@/lib/help-me-finish";
import {
  REWRITE_STATUS_TEXT,
  rewriteStatus,
} from "@/lib/ai-access";
import type { RewriteAvailability } from "./editor/FieldAiContext";

export type AiTab = "help" | "job" | "letter";

const TABS: { id: AiTab; label: string }[] = [
  { id: "help", label: "Help me finish" },
  { id: "job", label: "Match a job" },
  { id: "letter", label: "Cover letter" },
];

export interface AIPanelProps {
  doc: ResumeDocument;
  owner: string | null;
  availability: RewriteAvailability | "unreachable" | null;
  initialTab?: AiTab;
  /** Jump to the field an item is about and open its sparkle action. */
  onStartAction: (item: HelpItem) => void;
  onOpenAccount: () => void;
  /** Signed in while the open CV is still saved only in this browser. */
  signedIn?: boolean;
  onCopyToAccount?: () => void;
  onOpenCheck: () => void;
  /** The "Match a job" and "Cover letter" tools, built by the studio. */
  jobTab: ReactNode;
  letterTab: ReactNode;
}

/**
 * The one AI door: a to-do list of what to finish, a job comparison and a
 * cover letter. Writing help itself lives in each field's sparkle menu.
 */
export function AIPanel({
  doc,
  owner,
  availability,
  initialTab = "help",
  onStartAction,
  onOpenAccount,
  signedIn = false,
  onCopyToAccount,
  onOpenCheck,
  jobTab,
  letterTab,
}: AIPanelProps) {
  const [tab, setTab] = useState<AiTab>(initialTab);
  // Tools keep what was typed in them while another tab is open.
  const [visited, setVisited] = useState<Set<AiTab>>(new Set([initialTab]));
  const items = useMemo(() => helpMeFinish(doc), [doc]);
  const status = rewriteStatus(owner, availability, signedIn);

  function select(next: AiTab) {
    setTab(next);
    setVisited((previous) => new Set([...previous, next]));
  }

  return (
    <section className="ai-panel no-print" aria-label="AI Assistant tools">
      <div
        className="ai-tabs"
        role="tablist"
        aria-label="AI Assistant"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = TABS.findIndex((item) => item.id === tab);
          const next =
            event.key === "Home"
              ? TABS[0]
              : event.key === "End"
                ? TABS[TABS.length - 1]
                : TABS[
                    (index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) %
                      TABS.length
                  ];
          select(next.id);
          document.getElementById(`ai-tab-${next.id}`)?.focus();
        }}
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            id={`ai-tab-${item.id}`}
            type="button"
            role="tab"
            tabIndex={tab === item.id ? 0 : -1}
            aria-selected={tab === item.id}
            aria-controls={`ai-tabpanel-${item.id}`}
            className={`ai-tab-btn${tab === item.id ? " active" : ""}`}
            onClick={() => select(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="ai-tabpanel-help"
        aria-labelledby="ai-tab-help"
        hidden={tab !== "help"}
      >
        <p className="panel-intro">
          Things that would make your CV stronger. Each one opens the AI menu on
          the right field, and you review every change before it is applied.
        </p>
        <div
          className={`ai-status ${status === "ready" ? "ready" : "limited"}`}
          role="status"
        >
          {status === "ready" ? (
            <CircleCheck size={18} aria-hidden />
          ) : (
            <CircleAlert size={18} aria-hidden />
          )}
          <p>{REWRITE_STATUS_TEXT[status]}</p>
          {(status === "account-needed" || status === "session-expired") && (
            <button type="button" onClick={onOpenAccount}>
              Sign in
            </button>
          )}
          {status === "browser-cv" && onCopyToAccount && (
            <button type="button" className="primary" onClick={onCopyToAccount}>
              Copy to my account
            </button>
          )}
        </div>
        {items.length ? (
          <ol className="help-list" aria-label="What to finish">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartAction(item)}
                  aria-label={`${item.buttonLabel}: ${item.title}`}
                >
                  <Sparkles size={16} aria-hidden /> {item.buttonLabel}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="help-empty">
            <p>
              <strong>Nothing left to suggest.</strong> Your CV has a summary,
              results in its bullets and the skills they show. The sparkle menu
              on any field can still tighten wording.
            </p>
            <button type="button" onClick={onOpenCheck}>
              Check my CV
            </button>
          </div>
        )}
        <ImproveAllCv />
      </div>

      <div
        role="tabpanel"
        id="ai-tabpanel-job"
        aria-labelledby="ai-tab-job"
        hidden={tab !== "job"}
      >
        {visited.has("job") && jobTab}
      </div>
      <div
        role="tabpanel"
        id="ai-tabpanel-letter"
        aria-labelledby="ai-tab-letter"
        hidden={tab !== "letter"}
      >
        {visited.has("letter") && letterTab}
      </div>
    </section>
  );
}
