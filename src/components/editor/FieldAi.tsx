"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Check,
  FileText,
  Lightbulb,
  ListPlus,
  PenLine,
  TextCursorInput,
  Scissors,
  Sparkles,
  SpellCheck,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Menu, type MenuItem } from "./Menu";
import { useFieldAi } from "./FieldAiContext";
import { AiBlocked, AiConsent } from "./AiGate";
import { BlankFiller, blankState, blanksReady, composeBlanks, type BlankState } from "./BlankFiller";
import {
  type SkillsResult,
  type StartersResult,
} from "@/lib/ai-contract";
import { addSkillToText } from "@/lib/skills-taxonomy";
import {
  REWRITE_INSTRUCTIONS,
  diffWords,
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
  "ai-draft": Sparkles,
  skills: ListPlus,
  examples: Lightbulb,
  "ai-skills": Sparkles,
  continue: PenLine,
  selection: TextCursorInput,
};

/** Actions that ask the AI provider. */
type AiAction =
  | "improve"
  | "shorten"
  | "continue"
  | "selection"
  | "ai-draft"
  | "examples"
  | "ai-skills";
type BulletAction = "improve" | "shorten" | "continue" | "selection";

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
  | { stage: "consent"; action: AiAction }
  | { stage: "blocked"; status: RewriteStatus }
  | { stage: "working"; action: AiAction }
  | { stage: "locked"; message: string }
  | { stage: "choose-draft" }
  | { stage: "note"; message: string }
  | { stage: "questions"; proposal: Proposal }
  | { stage: "error"; message: string; retry?: AiAction; plans?: boolean }
  | { stage: "done"; message: string }
  | { stage: "examples-summary"; jobTitle: string; blanks: BlankState }
  | { stage: "examples-skills"; jobTitle: string; skills: string[]; picked: string[] }
  | { stage: "skills-ai"; result: SkillsResult; picked: string[]; group: boolean }
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
  /** The section and entry the field is in (skills: needed to group skills). */
  sectionId?: string;
  entryId?: string;
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
  sectionId,
  entryId,
  focusId,
  disabled = false,
  onApply,
}: FieldAiProps) {
  const ai = useFieldAi();
  const [session, setSession] = useState<Session | null>(null);
  const [metric, setMetric] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const regionId = useId();
  const primary = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  const generation = useRef<AbortController | null>(null);
  const request = useRef<{ key: string; id: string } | null>(null);
  const attempt = useRef(0);
  // Rewrite selection: the characters selected in the bullet when it started.
  const selected = useRef<{ start: number; end: number } | null>(null);

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
      stage === "review" ||
      stage === "examples-summary"
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
    if (!text.trim() && action !== "ai-draft")
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
    if (action === "selection") {
      const field = focusId
        ? (document.getElementById(focusId) as HTMLTextAreaElement | HTMLInputElement | null)
        : null;
      const start = field?.selectionStart ?? 0;
      const end = field?.selectionEnd ?? 0;
      if (end <= start || !text.slice(start, end).trim())
        return show(
          {
            stage: "note",
            message: "Select the words you want rewritten in the bullet first, then choose Rewrite selection.",
          },
          "Select some words first.",
        );
      selected.current = { start, end };
    }
    // improve, shorten, ai-draft or examples: needs the AI provider.
    if (status !== "ready")
      return show({ stage: "blocked", status }, REWRITE_STATUS_TEXT[status]);
    if (action === "ai-draft" && !services.summaryDrafts)
      return show(
        {
          stage: "locked",
          message: "AI summary drafts are part of Go and Pro. Quick draft works on every plan.",
        },
        "AI summary drafts are part of Go and Pro.",
      );
    if (action === "ai-skills" && !services.skillsAi)
      return show(
        {
          stage: "locked",
          message:
            "Suggesting skills with AI is part of Go and Pro. Add skills from my CV and Show examples work on every plan.",
        },
        "Suggest skills with AI is part of Go and Pro.",
      );
    if (action === "examples" && !services.starterTitle.trim())
      return show(
        {
          stage: "note",
          message:
            "Add your job title first: the headline under Contact, or a job under Experience. Examples are suggested for that title.",
        },
        "Add your job title first.",
      );
    if (!services.aiConsent)
      return show({ stage: "consent", action: action as AiAction });
    void run(action as AiAction);
  }

  function run(action: AiAction) {
    return action === "examples"
      ? examples()
      : action === "ai-skills"
        ? suggestSkills()
        : ask(action);
  }

  /** Suggest skills with AI: skills the CV shows, common ones, grouping. */
  async function suggestSkills() {
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    show({ stage: "working", action: "ai-skills" }, "Asking the AI for skills.");
    try {
      const snapshot = await services.prepare();
      if (!mounted.current || controller.signal.aborted) return;
      const result = (await accountRequest(
        "/api/ai/skills",
        {
          method: "POST",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
          }),
        },
        services.owner ?? undefined,
      )) as SkillsResult;
      if (!mounted.current || controller.signal.aborted) return;
      // Grouping rewrites one skills section, so it is offered only when there is one.
      const groupable =
        result.groups.length > 1 &&
        services.doc.sections.filter((s) => s.type === "skills").length === 1;
      const next = { ...result, groups: groupable ? result.groups : [] };
      if (!next.demonstrated.length && !next.roleSuggestions.length && !next.groups.length)
        return show(
          {
            stage: "note",
            message:
              next.message ||
              (next.withheld
                ? "The suggested skills could not be backed up by your CV, so they were withheld."
                : "No new skills to suggest. Add more detail to your jobs first."),
          },
          "No skills to suggest.",
        );
      return show(
        { stage: "skills-ai", result: next, picked: [], group: false },
        "Skill suggestions are ready. Tick the ones to add.",
      );
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      failed(error, "ai-skills");
    }
  }

  /** Adds the ticked skills and, if asked, groups the section, in one change. */
  function applySkills(current: Extract<Session, { stage: "skills-ai" }>) {
    const added = current.picked;
    if (current.group && sectionId) {
      services.updateDocument((draft) => {
        const section = draft.sections.find((s) => s.id === sectionId);
        if (!section) return;
        const groups = current.result.groups.map((g) => ({ ...g, skills: [...g.skills] }));
        if (added.length) {
          const other = groups.find((g) => g.name === "Other") ?? { name: "Other", skills: [] };
          if (!groups.includes(other)) groups.push(other);
          other.skills.push(...added);
        }
        // The first group keeps this entry's id, so this view stays open.
        section.entries = groups.map((group, index) => ({
          id: index === 0 && entryId ? entryId : crypto.randomUUID(),
          title: group.name,
          organization: "",
          location: "",
          start: "",
          end: "",
          current: false,
          description: group.skills.join(" · "),
          bullets: [],
        }));
      });
    } else {
      onApply(added.reduce((all, skill) => addSkillToText(all, skill), text));
    }
    const parts = [
      added.length ? `Added ${added.length} skill${added.length === 1 ? "" : "s"}` : "",
      current.group ? "grouped your skills" : "",
    ].filter(Boolean);
    show(
      { stage: "done", message: `${parts.join(" and ")}. Undo restores the previous skills.` },
      "Skills updated. Undo restores the previous skills.",
    );
  }

  /** What each AI action sends, said in every AI view. */
  function sendsText(action: AiAction) {
    if (action === "ai-draft")
      return "Sends your headline, jobs, bullets, education and skills to OpenAI. Contact details are not sent.";
    if (action === "examples")
      return `Sends only the job title “${services.starterTitle}” to OpenAI.`;
    if (action === "ai-skills")
      return "Sends your headline, jobs, bullets and listed skills to OpenAI. Contact details are not sent.";
    if (action === "selection" && selected.current)
      return `Rewrites only “${text.slice(selected.current.start, selected.current.end)}”. Sends this job’s ${sources} bullet${sources === 1 ? "" : "s"} to OpenAI. Contact details are not sent.`;
    return `Sends this job’s ${sources} bullet${sources === 1 ? "" : "s"} and the instruction to OpenAI. Contact details and other entries are not sent.`;
  }

  /** Shows an AI request error; a turned-off consent asks again. */
  function failed(error: unknown, action: AiAction) {
    if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
      return show({ stage: "consent", action });
    const message =
      error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
        ? "The assistant could not finish in time or lost its connection. Your CV was kept."
        : (error as Error).message;
    show(
      {
        stage: "error",
        message,
        retry: action,
        plans: error instanceof CloudRequestError && error.code === "AI_LIMIT",
      },
      message,
    );
  }

  /** Example summary or common skills for the job title, with blanks to fill. */
  async function examples() {
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    show({ stage: "working", action: "examples" }, "Asking the AI for examples.");
    const jobTitle = services.starterTitle.trim();
    try {
      const result = (await accountRequest(
        "/api/ai/starters",
        {
          method: "POST",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            jobTitle,
            section: kind === "summary" ? "summary" : "skills",
          }),
        },
        services.owner ?? undefined,
      )) as StartersResult;
      if (!mounted.current || controller.signal.aborted) return;
      if (kind === "summary") {
        if (!result.summary)
          return show(
            { stage: "note", message: `No example summary came back for “${jobTitle}”.` },
            "No example summary.",
          );
        return show(
          { stage: "examples-summary", jobTitle, blanks: blankState(result.summary) },
          "An example summary is ready. Fill its blanks before you add it.",
        );
      }
      const listed = text.toLowerCase();
      const skills = result.skills.filter((skill) => !listed.includes(skill.toLowerCase()));
      if (!skills.length)
        return show(
          {
            stage: "note",
            message: `Your skills already include the common skills for “${jobTitle}”.`,
          },
          "No new example skills.",
        );
      return show(
        { stage: "examples-skills", jobTitle, skills, picked: [] },
        "Example skills are ready. Tick only the ones that are true.",
      );
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      failed(error, "examples");
    }
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

  async function ask(action: BulletAction | "ai-draft") {
    generation.current?.abort();
    const controller = new AbortController();
    generation.current = controller;
    show({ stage: "working", action }, "Asking the AI for a suggestion.");
    try {
      const snapshot = await services.prepare();
      if (!mounted.current || controller.signal.aborted) return;
      if (action === "ai-draft") {
        const draft = (await accountRequest(
          "/api/ai/summary",
          {
            method: "POST",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]),
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
              documentId: snapshot.id,
              revision: snapshot.revision,
              consent: true,
            }),
          },
          services.owner ?? undefined,
        )) as { text: string; message: string };
        if (!mounted.current || controller.signal.aborted) return;
        setConfirmed(false);
        // The AI may decline rather than invent; say plainly that nothing was written.
        if (!draft.text) {
          const message = `No summary was written. ${draft.message || "Add more to your CV first."}`;
          return show({ stage: "note", message }, message);
        }
        return show(
          {
            stage: "review",
            action,
            before: text,
            after: draft.text,
            source: "ai",
            detail:
              draft.message ||
              "Written by AI from your CV. Check every claim before you accept it.",
          },
          "A summary draft is ready to review.",
        );
      }
      const instruction = REWRITE_INSTRUCTIONS[action];
      const mode =
        action === "continue" || action === "selection" ? action : undefined;
      const selection = action === "selection" ? selected.current : null;
      const key = JSON.stringify([
        snapshot.id,
        snapshot.revision,
        bulletId,
        instruction,
        mode ?? null,
        selection,
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
            ...(mode ? { mode } : {}),
            ...(selection ? { selection } : {}),
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
      failed(error, action);
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
      const action = session.action as BulletAction;
      void rejectProposal(proposal).catch(() => {});
      attempt.current += 1;
      await ask(action);
    } else if (session.action === "ai-draft") {
      await ask("ai-draft");
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
  const grouped = new Set(actions.map((def) => def.source)).size > 1;
  const items: MenuItem[] = actions.map((def, index) => {
    const Icon = ICONS[def.id];
    const unavailable = def.source === "ai" && status !== "ready";
    const starts = index === 0 || def.source !== actions[index - 1].source;
    return {
      label: def.label,
      hint: unavailable ? (SHORT_STATUS[status] ?? def.hint) : def.hint,
      icon: <Icon size={16} aria-hidden />,
      separated: index > 0 && starts,
      group:
        grouped && starts
          ? def.source === "ai"
            ? "AI writing help"
            : "Quick (no AI)"
          : undefined,
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
            if (
              session.stage === "review" ||
              session.stage === "questions" ||
              session.stage === "examples-summary" ||
              session.stage === "examples-skills" ||
              session.stage === "skills-ai"
            )
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
            <>
              <p className="field-ai-error" role="alert">
                {session.message}
              </p>
              {session.plans && (
                <button type="button" className="primary" onClick={services.onSeePlans}>
                  See plans
                </button>
              )}
            </>
          )}
          {session.stage === "blocked" && (
            <AiBlocked status={session.status} services={services} />
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
          {session.stage === "locked" && (
            <div className="field-ai-note">
              <p>{session.message}</p>
              <button type="button" className="primary" onClick={services.onSeePlans}>
                See plans
              </button>
            </div>
          )}
          {session.stage === "consent" && (
            <AiConsent
              sends={sendsText(session.action)}
              services={services}
              primaryRef={setPrimary}
              onAgreed={() => void run(session.action)}
              onCancel={() => {
                show(null);
                focusField();
              }}
            />
          )}
          {session.stage === "examples-summary" && (
            <div className="field-ai-form starter-review">
              <p className="starter-label">Example — make it yours</p>
              <p className="field-ai-help">
                An example summary for “{session.jobTitle}”, not a fact about
                you. Type your own details into the blanks, remove the ones you
                do not need, and change anything that is not true.
              </p>
              <BlankFiller
                label="Example summary"
                maxLength={1200}
                state={session.blanks}
                onChange={(blanks) => setSession({ ...session, blanks })}
              />
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!blanksReady(session.blanks)}
                  onClick={() => {
                    onApply(composeBlanks(session.blanks));
                    show(
                      { stage: "done", message: "Added. Undo restores your previous summary." },
                      "Summary added. Undo restores your previous summary.",
                    );
                    focusField();
                  }}
                >
                  <Check size={16} aria-hidden /> Use my edited summary
                </button>
                <button type="button" onClick={keepMine}>
                  <X size={16} aria-hidden /> Keep mine
                </button>
              </div>
            </div>
          )}
          {session.stage === "skills-ai" && (
            <div className="field-ai-form starter-review">
              {session.result.demonstrated.length > 0 && (
                <fieldset>
                  <legend>Shown in your CV</legend>
                  {session.result.demonstrated.map((item) => (
                    <div key={item.skill}>
                      <label className="field-ai-check">
                        <input
                          type="checkbox"
                          checked={session.picked.includes(item.skill)}
                          onChange={(event) =>
                            setSession({
                              ...session,
                              picked: event.target.checked
                                ? [...session.picked, item.skill]
                                : session.picked.filter((s) => s !== item.skill),
                            })
                          }
                        />
                        {item.skill}
                      </label>
                      <p className="entry-ai-source">
                        From your CV: {item.evidence.map((e) => `“${e}”`).join(" ")}
                      </p>
                    </div>
                  ))}
                </fieldset>
              )}
              {session.result.roleSuggestions.length > 0 && (
                <fieldset>
                  <legend>
                    Common for {session.result.role ? `“${session.result.role}”` : "your role"}: add only if true
                  </legend>
                  <p className="starter-label">Examples, not taken from your CV</p>
                  {session.result.roleSuggestions.map((skill) => (
                    <label key={skill} className="field-ai-check">
                      <input
                        type="checkbox"
                        checked={session.picked.includes(skill)}
                        onChange={(event) =>
                          setSession({
                            ...session,
                            picked: event.target.checked
                              ? [...session.picked, skill]
                              : session.picked.filter((s) => s !== skill),
                          })
                        }
                      />
                      {skill}
                    </label>
                  ))}
                </fieldset>
              )}
              {session.result.groups.length > 0 && (
                <fieldset>
                  <legend>Group your skills</legend>
                  <label className="field-ai-check">
                    <input
                      type="checkbox"
                      checked={session.group}
                      onChange={(event) =>
                        setSession({ ...session, group: event.target.checked })
                      }
                    />
                    Arrange your listed skills into groups
                  </label>
                  <ul className="skills-ai-groups">
                    {session.result.groups.map((group) => (
                      <li key={group.name}>
                        <strong>{group.name}:</strong> {group.skills.join(", ")}
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}
              {session.result.withheld > 0 && (
                <p className="field-ai-help">
                  {session.result.withheld} suggestion
                  {session.result.withheld === 1 ? " was" : "s were"} withheld because
                  your CV does not show {session.result.withheld === 1 ? "it" : "them"}.
                </p>
              )}
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  ref={setPrimary}
                  disabled={!session.picked.length && !session.group}
                  onClick={() => {
                    applySkills(session);
                    focusField();
                  }}
                >
                  <Check size={16} aria-hidden /> Add ticked
                </button>
                <button type="button" onClick={keepMine}>
                  <X size={16} aria-hidden /> Keep mine
                </button>
              </div>
            </div>
          )}
          {session.stage === "examples-skills" && (
            <div className="field-ai-form starter-review">
              <fieldset>
                <legend>Common for “{session.jobTitle}”: add only if true</legend>
                <p className="starter-label">Examples, not taken from your CV</p>
                {session.skills.map((skill) => (
                  <label key={skill} className="field-ai-check">
                    <input
                      type="checkbox"
                      checked={session.picked.includes(skill)}
                      onChange={(event) =>
                        setSession({
                          ...session,
                          picked: event.target.checked
                            ? [...session.picked, skill]
                            : session.picked.filter((item) => item !== skill),
                        })
                      }
                    />
                    {skill}
                  </label>
                ))}
              </fieldset>
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!session.picked.length}
                  onClick={() => {
                    const count = session.picked.length;
                    onApply(
                      session.picked.reduce((all, skill) => addSkillToText(all, skill), text),
                    );
                    show(
                      {
                        stage: "done",
                        message: `Added ${count} skill${count === 1 ? "" : "s"}. Undo removes them.`,
                      },
                      "Skills added. Undo removes them.",
                    );
                    focusField();
                  }}
                >
                  <Check size={16} aria-hidden /> Add ticked skills
                </button>
                <button type="button" onClick={keepMine}>
                  <X size={16} aria-hidden /> Keep mine
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
              <p className="field-ai-help">{sendsText(session.action)}</p>
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
