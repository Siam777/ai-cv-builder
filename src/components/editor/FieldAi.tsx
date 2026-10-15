"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Check,
  FileText,
  ListPlus,
  Scissors,
  Sparkles,
  SpellCheck,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Menu, type MenuItem } from "./Menu";
import { useFieldAi } from "./FieldAiContext";
import {
  REWRITE_INSTRUCTIONS,
  diffWords,
  fieldAction,
  fieldActions,
  fixGrammar,
  skillsProposal,
  type DiffPart,
  type FieldActionId,
  type FieldKind,
} from "@/lib/field-ai";
import {
  REWRITE_STATUS_TEXT,
  rewriteStatus,
  type RewriteStatus,
} from "@/lib/ai-access";
import { bulletEvidence, proposalSchema, type Proposal } from "@/lib/ai-proposals";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import {
  generateExecutiveSummaries,
  generateInterviewClarifications,
} from "@/lib/vault/ai-assistant";
import { synthesizeVerifiedXyzBullet } from "@/lib/vault/impact-coach";

const ICONS: Record<FieldActionId, LucideIcon> = {
  improve: Wand2,
  result: Calculator,
  shorten: Scissors,
  grammar: SpellCheck,
  draft: FileText,
  skills: ListPlus,
};

const SHORT_STATUS: Partial<Record<RewriteStatus, string>> = {
  checking: "Checking…",
  unreachable: "Could not check",
  "account-needed": "Needs your account",
  "browser-cv": "Copy CV to your account",
  "session-expired": "Sign in again",
  "not-configured": "Not set up here",
};

type Session =
  | { stage: "ask-result" }
  | { stage: "consent"; action: "improve" | "shorten" }
  | { stage: "blocked"; status: RewriteStatus }
  | { stage: "working"; action: "improve" | "shorten" }
  | { stage: "choose-draft" }
  | { stage: "note"; message: string }
  | { stage: "questions"; proposal: Proposal }
  | { stage: "error"; message: string; retry?: "improve" | "shorten" }
  | { stage: "done"; message: string }
  | {
      stage: "review";
      action: FieldActionId;
      before: string;
      after: string;
      source: "local" | "ai";
      proposal?: Proposal;
      detail: string;
    };

export interface FieldAiProps {
  kind: FieldKind;
  /** Names the field for assistive technology, such as "Bullet 2". */
  label: string;
  text: string;
  bulletId?: string;
  /** DOM id of the field, so focus can return to it. */
  focusId?: string;
  disabled?: boolean;
  onApply: (text: string) => void;
}

function Side({
  parts,
  keep,
  mark,
}: {
  parts: DiffPart[];
  keep: "del" | "ins";
  mark: "del" | "ins";
}) {
  return (
    <p className="field-ai-text">
      {parts
        .filter((part) => part.type === "same" || part.type === keep)
        .map((part, index) =>
          part.type === mark ? (
            mark === "del" ? (
              <del key={index}>{part.text}</del>
            ) : (
              <ins key={index}>{part.text}</ins>
            )
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
    </p>
  );
}

/**
 * The sparkle menu for one field and the inline accept or reject view it
 * opens. Local actions run in the browser; Improve and Shorten ask the AI
 * provider (account CVs only) and show the same view. Nothing is applied
 * until the person accepts.
 */
export function FieldAi({
  kind,
  label,
  text,
  bulletId,
  focusId,
  disabled = false,
  onApply,
}: FieldAiProps) {
  const ai = useFieldAi();
  const [session, setSession] = useState<Session | null>(null);
  const [metric, setMetric] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const regionId = useId();
  const primary = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  const generation = useRef<AbortController | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current?.abort();
    };
  }, []);

  const stage = session?.stage;
  useEffect(() => {
    if (
      stage === "ask-result" ||
      stage === "consent" ||
      stage === "choose-draft" ||
      stage === "review"
    )
      primary.current?.focus();
  }, [stage]);

  // The AI Assistant can ask this field to start an action.
  const pending = ai?.pending;
  useEffect(() => {
    if (!ai || !pending || disabled) return;
    if (pending.kind !== kind) return;
    if (kind === "bullet" && pending.bulletId !== bulletId) return;
    ai.consumePending(pending.id);
    begin(pending.action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const status = useMemo(
    () =>
      ai ? rewriteStatus(ai.owner, ai.availability, ai.signedIn) : "account-needed",
    [ai],
  );
  if (!ai) return null;
  const services = ai;

  const sources = bulletId
    ? (() => {
        const all = bulletEvidence(services.doc);
        const self = all.find((b) => b.id === bulletId);
        return all.filter(
          (b) => b.entryId === self?.entryId && b.sectionId === self?.sectionId,
        ).length;
      })()
    : 0;

  function show(next: Session | null, message = "") {
    setSession(next);
    setAnnounce(message);
  }

  function begin(action: FieldActionId) {
    setConfirmed(false);
    attempt.current = 0;
    request.current = null;
    if (action === "draft") {
      if (!generateExecutiveSummaries(services.doc).length)
        return show(
          {
            stage: "note",
            message:
              "Add your role, experience or skills first. There is nothing to draft a summary from yet.",
          },
          "Nothing to draft from yet.",
        );
      return show({ stage: "choose-draft" });
    }
    if (action === "skills") {
      const found = skillsProposal(services.doc, text);
      if (!found.skills.length)
        return show(
          {
            stage: "note",
            message:
              "No new skills found. Skills your bullets mention are already listed.",
          },
          "No new skills found.",
        );
      return show({
        stage: "review",
        action,
        before: text,
        after: found.text,
        source: "local",
        detail: `Found in your experience: ${found.skills.join(", ")}.`,
      });
    }
    if (!text.trim())
      return show(
        { stage: "note", message: "Write something first, then ask for help." },
        "Write something first.",
      );
    if (action === "grammar") {
      const fixed = fixGrammar(text);
      if (fixed === text)
        return show(
          {
            stage: "note",
            message:
              "No spacing, capital or repeated-word fixes found. This check is limited, so read it through once yourself.",
          },
          "No grammar fixes found.",
        );
      return show({
        stage: "review",
        action,
        before: text,
        after: fixed,
        source: "local",
        detail:
          "Fixes spacing, capitals and repeated words only. Your meaning is unchanged.",
      });
    }
    if (action === "result") {
      setMetric("");
      return show({ stage: "ask-result" });
    }
    // improve or shorten: needs the AI provider.
    if (status !== "ready")
      return show({ stage: "blocked", status }, REWRITE_STATUS_TEXT[status]);
    setConsent(false);
    show({ stage: "consent", action });
  }

  function previewResult() {
    const result = metric.trim();
    if (!result) return;
    show({
      stage: "review",
      action: "result",
      before: text,
      after: synthesizeVerifiedXyzBullet(text, result),
      source: "local",
      detail:
        "Built from your bullet and the result you typed. Only keep it if the result is true.",
    });
  }

  async function ask(action: "improve" | "shorten") {
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    show({ stage: "working", action }, "Asking the AI for a suggestion.");
    try {
      const snapshot = await services.prepare();
      if (!mounted.current || controller.signal.aborted) return;
      const instruction = REWRITE_INSTRUCTIONS[action];
      const key = JSON.stringify([
        snapshot.id,
        snapshot.revision,
        bulletId,
        instruction,
        attempt.current,
      ]);
      if (request.current?.key !== key)
        request.current = { key, id: crypto.randomUUID() };
      const result = await accountRequest(
        "/api/ai",
        {
          method: "POST",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
          body: JSON.stringify({
            requestId: request.current.id,
            documentId: snapshot.id,
            revision: snapshot.revision,
            bulletId,
            instruction,
            consent: true,
          }),
        },
        services.owner ?? undefined,
      );
      if (!mounted.current || controller.signal.aborted) return;
      const proposal = proposalSchema.parse(result);
      const operation = proposal.operations.find((o) => o.bulletId === bulletId);
      setConfirmed(false);
      if (!operation) {
        show({ stage: "questions", proposal }, "The AI has a question.");
        return;
      }
      show(
        {
          stage: "review",
          action,
          before: operation.before,
          after: operation.text,
          source: "ai",
          proposal,
          detail: proposal.message,
        },
        "A suggestion is ready to review.",
      );
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      if (
        error instanceof CloudRequestError &&
        [
          "AI_FINISHED",
          "AI_REQUEST_CHANGED",
          "AI_INVALID_RESPONSE",
          "AI_INVALID_EVIDENCE",
          "AI_UNAVAILABLE",
          "AI_REFUSED",
        ].includes(error.code)
      )
        request.current = null;
      const message =
        error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
          ? "The assistant could not finish in time or lost its connection. Your CV was kept."
          : (error as Error).message;
      show({ stage: "error", message, retry: action }, message);
    }
  }

  function cancelAsk() {
    generation.current?.abort();
    show(null, "Cancelled. Your CV was not changed.");
    focusField();
  }

  function focusField() {
    if (focusId)
      requestAnimationFrame(() => document.getElementById(focusId)?.focus());
  }

  async function rejectProposal(proposal: Proposal) {
    await accountRequest(
      `/api/ai/${encodeURIComponent(proposal.id)}`,
      {
        method: "POST",
        body: JSON.stringify({ decision: "reject", confirmed: true }),
      },
      services.owner ?? undefined,
    );
  }

  /** Keep mine: close the view; an AI suggestion is also rejected on the server. */
  function keepMine() {
    const current = session;
    const proposal =
      current?.stage === "review"
        ? current.proposal
        : current?.stage === "questions"
          ? current.proposal
          : undefined;
    show(null, "Kept your wording. Nothing changed.");
    request.current = null;
    if (proposal) void rejectProposal(proposal).catch(() => {});
    focusField();
  }

  async function tryAgain() {
    if (session?.stage !== "review") return;
    if (session.source === "ai" && session.proposal) {
      const proposal = session.proposal;
      const action = session.action as "improve" | "shorten";
      void rejectProposal(proposal).catch(() => {});
      attempt.current += 1;
      await ask(action);
    } else if (session.action === "result") {
      show({ stage: "ask-result" });
    } else if (session.action === "draft") {
      show({ stage: "choose-draft" });
    }
  }

  async function accept() {
    if (session?.stage !== "review") return;
    const current = session;
    try {
      if (current.source === "ai" && current.proposal) {
        await services.accept(current.proposal);
        request.current = null;
      } else {
        onApply(current.after);
      }
      show(
        {
          stage: "done",
          message: "Applied. Undo restores your previous wording.",
        },
        "Change applied. Undo restores your previous wording.",
      );
      focusField();
    } catch (error) {
      show(
        { stage: "error", message: (error as Error).message },
        (error as Error).message,
      );
    }
  }

  const actions = fieldActions(kind);
  const items: MenuItem[] = actions.map((def, index) => {
    const Icon = ICONS[def.id];
    const unavailable = def.source === "ai" && status !== "ready";
    return {
      label: def.label,
      hint: unavailable ? (SHORT_STATUS[status] ?? def.hint) : def.hint,
      icon: <Icon size={16} aria-hidden />,
      separated: index > 0 && def.source !== actions[index - 1].source,
      onSelect: () => begin(def.id),
    };
  });

  const setPrimary = (element: HTMLElement | null) => {
    primary.current = element;
  };

  return (
    <div className="field-ai" data-field-ai={kind}>
      <Menu
        ariaLabel={`AI help for ${label}`}
        label={
          <>
            <Sparkles size={16} aria-hidden />
            <span>AI</span>
          </>
        }
        items={items}
        disabled={disabled}
        className="field-ai-menu"
      />
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      {session && (
        <div
          id={regionId}
          className="field-ai-card"
          role="group"
          aria-label={`AI help for ${label}`}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || session.stage === "working") return;
            event.preventDefault();
            event.stopPropagation();
            if (session.stage === "review" || session.stage === "questions")
              keepMine();
            else show(null);
            focusField();
          }}
        >
          {session.stage === "note" && (
            <p className="field-ai-note">{session.message}</p>
          )}
          {session.stage === "done" && (
            <p className="field-ai-note">
              <Check size={16} aria-hidden /> {session.message}
            </p>
          )}
          {session.stage === "error" && (
            <p className="field-ai-error" role="alert">
              {session.message}
            </p>
          )}
          {session.stage === "blocked" && (
            <div className="field-ai-note">
              <p>{REWRITE_STATUS_TEXT[session.status]}</p>
              {(session.status === "account-needed" ||
                session.status === "session-expired") && (
                <button type="button" onClick={services.onOpenAccount}>
                  Sign in
                </button>
              )}
              {session.status === "browser-cv" && (
                <button type="button" className="primary" onClick={services.onCopyToAccount}>
                  Copy to my account
                </button>
              )}
            </div>
          )}
          {session.stage === "ask-result" && (
            <form
              className="field-ai-form"
              onSubmit={(event) => {
                event.preventDefault();
                previewResult();
              }}
            >
              <label>
                What was the real result?
                <input
                  ref={setPrimary}
                  value={metric}
                  maxLength={300}
                  placeholder={`e.g. ${
                    generateInterviewClarifications(services.doc, 1, bulletId)[0]
                      ?.exampleAnswers[0] ?? "35% faster weekly reports"
                  }`}
                  onChange={(event) => setMetric(event.target.value)}
                />
              </label>
              <p className="field-ai-help">
                Use a number or outcome you can back up. Nothing is invented for
                you.
              </p>
              <div className="field-ai-actions">
                <button type="submit" className="primary" disabled={!metric.trim()}>
                  Preview change
                </button>
                <button type="button" onClick={() => show(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {session.stage === "consent" && (
            <div className="field-ai-form">
              <p>
                <strong>{fieldAction(session.action).label}</strong> sends this
                job&apos;s {sources} bullet{sources === 1 ? "" : "s"} and the
                instruction to OpenAI. Contact details and other entries are not
                sent.
              </p>
              <label className="field-ai-check">
                <input
                  ref={setPrimary}
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                Send this to OpenAI
              </label>
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!consent}
                  onClick={() => void ask(session.action)}
                >
                  Suggest a rewrite
                </button>
                <button type="button" onClick={() => show(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {session.stage === "working" && (
            <div className="field-ai-form">
              <p role="status">
                Asking the AI. This can take up to a minute. Nothing changes
                until you accept.
              </p>
              <div className="field-ai-actions">
                <button type="button" onClick={cancelAsk}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {session.stage === "choose-draft" && (
            <div className="field-ai-form">
              <p className="field-ai-help">
                Pick a starting point built from details already in your CV. You
                can edit it afterwards.
              </p>
              <ul className="field-ai-drafts">
                {generateExecutiveSummaries(services.doc).map((draft, index) => (
                  <li key={draft.id}>
                    <strong>{draft.title}</strong>
                    <span>{draft.text}</span>
                    <button
                      type="button"
                      ref={index === 0 ? setPrimary : undefined}
                      aria-label={`Preview draft: ${draft.title}`}
                      onClick={() =>
                        show({
                          stage: "review",
                          action: "draft",
                          before: text,
                          after: draft.text,
                          source: "local",
                          detail: `${draft.title}: ${draft.description}`,
                        })
                      }
                    >
                      Preview
                    </button>
                  </li>
                ))}
              </ul>
              <div className="field-ai-actions">
                <button type="button" onClick={() => show(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {session.stage === "questions" && (
            <div className="field-ai-form">
              <p>{session.proposal.message}</p>
              {session.proposal.questions.length > 0 && (
                <ul>
                  {session.proposal.questions.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              )}
              <div className="field-ai-actions">
                <button type="button" onClick={keepMine}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {session.stage === "review" && (
            <div className="field-ai-review">
              {(() => {
                const parts = diffWords(session.before, session.after);
                return (
                  <>
                    <div>
                      <span className="field-ai-label">Your wording</span>
                      <Side parts={parts} keep="del" mark="del" />
                    </div>
                    <div>
                      <span className="field-ai-label">Suggested</span>
                      <Side parts={parts} keep="ins" mark="ins" />
                    </div>
                  </>
                );
              })()}
              <p className="field-ai-help">{session.detail}</p>
              {session.source === "ai" && (
                <>
                  <p className="field-ai-help">
                    The support check can make mistakes. Check every claim
                    against your own experience.
                  </p>
                  <label className="field-ai-check">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    I checked the wording and it accurately describes my
                    experience.
                  </label>
                </>
              )}
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  ref={setPrimary}
                  disabled={session.source === "ai" && !confirmed}
                  onClick={() => void accept()}
                >
                  <Check size={16} aria-hidden /> Accept
                </button>
                {(session.source === "ai" ||
                  session.action === "result" ||
                  session.action === "draft") && (
                  <button type="button" onClick={() => void tryAgain()}>
                    {session.action === "draft"
                      ? "Pick another"
                      : session.action === "result"
                        ? "Change result"
                        : "Try again"}
                  </button>
                )}
                <button type="button" onClick={keepMine}>
                  <X size={16} aria-hidden /> Keep mine
                </button>
              </div>
            </div>
          )}
          {["note", "done", "error", "blocked"].includes(session.stage) && (
            <button
              type="button"
              className="field-ai-dismiss"
              onClick={() => {
                show(null);
                focusField();
              }}
            >
              Close
            </button>
          )}
        </div>
      )}
    </div>
  );
}
