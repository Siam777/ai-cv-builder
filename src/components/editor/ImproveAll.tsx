"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Wand2, X } from "lucide-react";
import { useFieldAi } from "./FieldAiContext";
import { AiBlocked, AiConsent } from "./AiGate";
import { AiProgress } from "./AiProgress";
import { rewriteStatus, REWRITE_STATUS_TEXT, type RewriteStatus } from "@/lib/ai-access";
import { proposalSchema, type Proposal } from "@/lib/ai-proposals";
import { REWRITE_INSTRUCTIONS, diffWords } from "@/lib/field-ai";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import type { ResumeDocument } from "@/lib/document";

type Session =
  | { stage: "blocked"; status: RewriteStatus }
  | { stage: "locked" }
  | { stage: "consent" }
  | { stage: "working" }
  | { stage: "review"; proposal: Proposal; picked: string[]; confirmed: boolean }
  | { stage: "note"; message: string; questions: string[] }
  | { stage: "error"; message: string; plans?: boolean }
  | { stage: "done"; message: string };

/** A job or project with bullets that Improve all can work on. */
export interface ImproveTarget {
  sectionId: string;
  entryId: string;
  label: string;
}

/** Jobs and projects with at least one written bullet, in CV order. */
export function improveTargets(doc: ResumeDocument): ImproveTarget[] {
  return doc.sections
    .filter((s) => s.type === "experience" || s.type === "projects")
    .flatMap((section) =>
      section.entries
        .filter((entry) => entry.bullets.some((b) => b.text.trim()))
        .map((entry) => ({
          sectionId: section.id,
          entryId: entry.id,
          label:
            [entry.title.trim(), entry.organization.trim()].filter(Boolean).join(" at ") ||
            "Untitled entry",
        })),
    );
}

function Diff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <div className="improve-all-diff">
      <p className="field-ai-text">
        <span className="field-ai-label">Your wording</span>{" "}
        {parts
          .filter((p) => p.type !== "ins")
          .map((p, i) => (p.type === "del" ? <del key={i}>{p.text}</del> : <span key={i}>{p.text}</span>))}
      </p>
      <p className="field-ai-text">
        <span className="field-ai-label">Suggested</span>{" "}
        {parts
          .filter((p) => p.type !== "del")
          .map((p, i) => (p.type === "ins" ? <ins key={i}>{p.text}</ins> : <span key={i}>{p.text}</span>))}
      </p>
    </div>
  );
}

/**
 * Improve all bullets of one job or project in one AI request (Go and Pro).
 * One review list: tick the rewrites to keep; one Undo restores them all.
 */
export function ImproveAll({
  target,
  autoStart = false,
  onFinished,
}: {
  target: ImproveTarget;
  /** Start straight away (the CV-wide run). */
  autoStart?: boolean;
  /** Called after accepting, keeping mine or a note, so a CV-wide run can move on. */
  onFinished?: () => void;
}) {
  const ai = useFieldAi();
  const [session, setSession] = useState<Session | null>(null);
  const [announce, setAnnounce] = useState("");
  const mounted = useRef(true);
  const started = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!autoStart || started.current || !ai) return;
    started.current = true;
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, ai]);

  if (!ai) return null;
  const services = ai;
  const status = rewriteStatus(services.owner, services.availability, services.signedIn);
  const entry = services.doc.sections
    .find((s) => s.id === target.sectionId)
    ?.entries.find((e) => e.id === target.entryId);
  const count = entry?.bullets.filter((b) => b.text.trim()).length ?? 0;

  function show(next: Session | null, message = "") {
    setSession(next);
    setAnnounce(message);
  }

  function begin(consented = services.aiConsent) {
    if (status !== "ready") return show({ stage: "blocked", status }, REWRITE_STATUS_TEXT[status]);
    if (!services.improveAll) return show({ stage: "locked" }, "Improve all bullets is part of Go and Pro.");
    if (!consented) return show({ stage: "consent" });
    void run();
  }

  async function run() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    show({ stage: "working" }, `Improving the bullets of ${target.label}.`);
    try {
      const snapshot = await services.prepare();
      const first = snapshot.sections
        .find((s) => s.id === target.sectionId)
        ?.entries.find((e) => e.id === target.entryId)
        ?.bullets.find((b) => b.text.trim());
      if (!first) return show({ stage: "note", message: "This entry has no bullets yet.", questions: [] });
      const result = await accountRequest(
        "/api/ai",
        {
          method: "POST",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            bulletId: first.id,
            instruction: REWRITE_INSTRUCTIONS.improve,
            consent: true,
            mode: "entry",
          }),
        },
        services.owner ?? undefined,
      );
      if (!mounted.current || abort.signal.aborted) return;
      const proposal = proposalSchema.parse(result);
      if (!proposal.operations.length)
        return show(
          {
            stage: "note",
            message: proposal.message || "No rewrites to suggest for this entry.",
            questions: proposal.questions,
          },
          "No rewrites to suggest.",
        );
      show(
        { stage: "review", proposal, picked: [], confirmed: false },
        `${proposal.operations.length} rewrites are ready. Tick the ones to keep.`,
      );
    } catch (error) {
      if (!mounted.current || abort.signal.aborted) return;
      if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
        return show({ stage: "consent" });
      const message =
        error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
          ? "The assistant could not finish in time or lost its connection. Your CV was kept."
          : (error as Error).message;
      show(
        {
          stage: "error",
          message,
          plans: error instanceof CloudRequestError && (error.code === "AI_LIMIT" || error.code === "PLAN_REQUIRED"),
        },
        message,
      );
    }
  }

  async function keepMine(proposal?: Proposal) {
    show(null, "Kept your wording. Nothing changed.");
    if (proposal)
      void accountRequest(
        `/api/ai/${encodeURIComponent(proposal.id)}`,
        { method: "POST", body: JSON.stringify({ decision: "reject", confirmed: true }) },
        services.owner ?? undefined,
      ).catch(() => {});
    onFinished?.();
  }

  async function accept(current: Extract<Session, { stage: "review" }>) {
    try {
      await services.accept(current.proposal, current.picked);
      const n = current.picked.length;
      show(
        { stage: "done", message: `Applied ${n} rewrite${n === 1 ? "" : "s"}. Undo restores your previous wording.` },
        "Rewrites applied. Undo restores your previous wording.",
      );
      onFinished?.();
    } catch (error) {
      show({ stage: "error", message: (error as Error).message }, (error as Error).message);
    }
  }

  return (
    <div className="improve-all field-ai">
      {!autoStart && (
        <button
          type="button"
          className="improve-all-start"
          disabled={!count || session?.stage === "working"}
          aria-label={`Improve all bullets: ${target.label}`}
          onClick={() => begin()}
        >
          <Wand2 size={16} aria-hidden /> Improve all bullets
        </button>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      {session && (
        <div className="field-ai-card" role="group" aria-label={`Improve all bullets: ${target.label}`}>
          {session.stage === "blocked" && <AiBlocked status={session.status} services={services} />}
          {session.stage === "locked" && (
            <div className="field-ai-note">
              <p>
                Improving every bullet of a job in one go is part of Go and Pro.
                Improve wording works on each bullet on every plan.
              </p>
              <button type="button" className="primary" onClick={services.onSeePlans}>
                See plans
              </button>
            </div>
          )}
          {session.stage === "consent" && (
            <AiConsent
              services={services}
              sends={`Sends the ${count} bullets of ${target.label} to OpenAI. Contact details are not sent.`}
              onAgreed={() => begin(true)}
              onCancel={() => keepMine()}
            />
          )}
          {session.stage === "working" && (
            <AiProgress
              title={`Improving the bullets of ${target.label}`}
              steps={["Reading the bullets", "Rewriting each one", "Checking each one says nothing new"]}
              sends={`Sends the ${count} bullets of ${target.label}. Contact details are not sent.`}
              onCancel={() => { controller.current?.abort(); show(null, "Cancelled. Your CV was not changed."); onFinished?.(); }}
            />
          )}
          {session.stage === "review" && (
            <div className="field-ai-form entry-ai-review">
              {session.proposal.message && <p className="field-ai-help">{session.proposal.message}</p>}
              <fieldset>
                <legend>Tick the rewrites to keep.</legend>
                <ul className="entry-ai-list">
                  {session.proposal.operations.map((op, index) => (
                    <li key={op.bulletId}>
                      <label className="field-ai-check">
                        <input
                          type="checkbox"
                          checked={session.picked.includes(op.bulletId)}
                          onChange={(event) =>
                            setSession({
                              ...session,
                              picked: event.target.checked
                                ? [...session.picked, op.bulletId]
                                : session.picked.filter((id) => id !== op.bulletId),
                            })
                          }
                        />
                        Keep rewrite {index + 1}
                      </label>
                      <Diff before={op.before} after={op.text} />
                    </li>
                  ))}
                </ul>
              </fieldset>
              <p className="field-ai-help">
                The support check can make mistakes. Check every claim against your own experience.
              </p>
              <label className="field-ai-check">
                <input
                  type="checkbox"
                  checked={session.confirmed}
                  onChange={(event) => setSession({ ...session, confirmed: event.target.checked })}
                />
                I checked the ticked rewrites and they accurately describe my experience.
              </label>
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!session.picked.length || !session.confirmed}
                  onClick={() => void accept(session)}
                >
                  <Check size={16} aria-hidden /> Accept ticked
                </button>
                <button type="button" onClick={() => void keepMine(session.proposal)}>
                  <X size={16} aria-hidden /> Keep mine
                </button>
              </div>
            </div>
          )}
          {session.stage === "note" && (
            <div className="field-ai-note">
              <p>{session.message}</p>
              {session.questions.length > 0 && (
                <ul>
                  {session.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {session.stage === "error" && (
            <div className="field-ai-note">
              <p className="field-ai-error" role="alert">{session.message}</p>
              {session.plans && (
                <button type="button" className="primary" onClick={services.onSeePlans}>
                  See plans
                </button>
              )}
            </div>
          )}
          {session.stage === "done" && (
            <p className="field-ai-note">
              <Check size={16} aria-hidden /> {session.message}
            </p>
          )}
          {["note", "error", "done", "blocked", "locked"].includes(session.stage) && (
            <button
              type="button"
              className="field-ai-dismiss"
              onClick={() => {
                const wasNote = session.stage === "note";
                show(null);
                if (wasNote || session.stage === "error") onFinished?.();
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

/**
 * Improve all bullets across the CV, one job or project at a time: each is
 * reviewed (or skipped) before the next is asked for, so every proposal is
 * made against the CV as it is after the previous decision.
 */
export function ImproveAllCv() {
  const ai = useFieldAi();
  const [queue, setQueue] = useState<ImproveTarget[] | null>(null);
  const [index, setIndex] = useState(0);
  if (!ai) return null;
  const targets = improveTargets(ai.doc);
  if (!targets.length) return null;
  const current = queue?.[index];
  return (
    <section className="improve-all-cv" aria-label="Improve all bullets in my CV">
      {!queue ? (
        <button type="button" onClick={() => { setQueue(targets); setIndex(0); }}>
          <Wand2 size={16} aria-hidden /> Improve all bullets in my CV
        </button>
      ) : current ? (
        <>
          <p role="status">
            Job {index + 1} of {queue.length}: <strong>{current.label}</strong>
          </p>
          <ImproveAll key={current.entryId} target={current} autoStart onFinished={() => {}} />
          <div className="field-ai-actions">
            <button type="button" onClick={() => setIndex((i) => i + 1)}>
              {index + 1 < queue.length ? "Next job" : "Finish"}
            </button>
            <button type="button" onClick={() => setQueue(null)}>
              Stop
            </button>
          </div>
        </>
      ) : (
        <p role="status" className="field-ai-note">
          <Check size={16} aria-hidden /> Done: every job was reviewed.{" "}
          <button type="button" onClick={() => setQueue(null)}>
            Close
          </button>
        </p>
      )}
    </section>
  );
}
