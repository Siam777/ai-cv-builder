"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lightbulb, Sparkles, X } from "lucide-react";
import { useFieldAi } from "./FieldAiContext";
import { AiBlocked, AiConsent } from "./AiGate";
import { BlankFiller, blankState, blanksReady, composeBlanks, type BlankState } from "./BlankFiller";
import {
  REWRITE_STATUS_TEXT,
  rewriteStatus,
  type RewriteStatus,
} from "@/lib/ai-access";
import {
  STARTER_SENIORITY,
  type EntryBulletsResult,
  type StartersResult,
} from "@/lib/ai-contract";
import { accountRequest, CloudRequestError } from "@/lib/cloud-repository";
import type { Entry } from "@/lib/document";

type Flow = "write" | "examples";
type Seniority = (typeof STARTER_SENIORITY)[number];

interface Pick {
  id: string;
  text: string;
  picked: boolean;
}

type Session =
  | { stage: "blocked"; status: RewriteStatus }
  | { stage: "consent"; flow: Flow }
  | { stage: "notes"; prompts: string[] }
  | { stage: "working"; flow: Flow }
  | {
      stage: "review";
      result: EntryBulletsResult;
      bullets: (Pick & { evidence: string[] })[];
      useTitle: boolean;
    }
  | {
      stage: "examples";
      jobTitle: string;
      seniority: Seniority | "";
      cached: boolean;
      bullets: { id: string; blanks: BlankState; picked: boolean }[];
    }
  | { stage: "error"; message: string; flow: Flow; plans?: boolean }
  | { stage: "done"; message: string };

const SENIORITY_LABEL: Record<Seniority, string> = {
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  lead: "Lead or manager",
};

/**
 * AI help for one job or project: Write with AI turns the person's notes into
 * bullets (each citing the notes), and Show examples gives labelled examples
 * for the job title with blanks to fill. Nothing is added until the person
 * ticks items and accepts; one Undo removes everything added.
 */
export function EntryAi({
  sectionId,
  entry,
  noun,
  disabled = false,
  autoOpen = false,
  onAdd,
}: {
  sectionId: string;
  entry: Entry;
  /** "job" or "project". */
  noun: string;
  disabled?: boolean;
  /** Open the notes box straight away (used by the AI interview). */
  autoOpen?: boolean;
  onAdd: (bullets: string[], title?: string) => void;
}) {
  const ai = useFieldAi();
  const [session, setSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState("");
  const [duties, setDuties] = useState("");
  const [announce, setAnnounce] = useState("");
  const mounted = useRef(true);
  const generation = useRef<AbortController | null>(null);
  const primary = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current?.abort();
    };
  }, []);
  const opened = useRef(false);
  useEffect(() => {
    if (!autoOpen || opened.current || !ai) return;
    opened.current = true;
    begin("write");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, ai]);
  const stage = session?.stage;
  useEffect(() => {
    if (stage && stage !== "working") primary.current?.focus();
  }, [stage]);

  if (!ai) return null;
  const services = ai;
  const status = rewriteStatus(services.owner, services.availability, services.signedIn);
  const title = entry.title.trim();
  const label = title || `this ${noun}`;

  function show(next: Session | null, message = "") {
    setSession(next);
    setAnnounce(message);
  }
  const setPrimary = (element: HTMLElement | null) => {
    primary.current = element;
  };

  function begin(flow: Flow, prompts: string[] = [], consented = services.aiConsent) {
    if (status !== "ready")
      return show({ stage: "blocked", status }, REWRITE_STATUS_TEXT[status]);
    if (!consented) return show({ stage: "consent", flow });
    if (flow === "write") return show({ stage: "notes", prompts });
    void fetchExamples("");
  }

  function failed(error: unknown, flow: Flow) {
    if (error instanceof CloudRequestError && error.code === "AI_CONSENT_REQUIRED")
      return show({ stage: "consent", flow });
    const message =
      error instanceof CloudRequestError && error.code === "NETWORK_ERROR"
        ? "The assistant could not finish in time or lost its connection. Your CV was kept."
        : (error as Error).message;
    show(
      {
        stage: "error",
        message,
        flow,
        plans: error instanceof CloudRequestError && error.code === "AI_LIMIT",
      },
      message,
    );
  }

  function controller() {
    generation.current?.abort();
    const next = new AbortController();
    generation.current = next;
    return next;
  }

  async function writeBullets() {
    const abort = controller();
    show({ stage: "working", flow: "write" }, "Writing bullets from your notes.");
    try {
      const snapshot = await services.prepare();
      if (!mounted.current || abort.signal.aborted) return;
      const result = (await accountRequest(
        "/api/ai/entry-bullets",
        {
          method: "POST",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            documentId: snapshot.id,
            revision: snapshot.revision,
            sectionId,
            entryId: entry.id,
            notes: notes.trim(),
            ...(duties.trim() ? { duties: duties.trim() } : {}),
          }),
        },
        services.owner ?? undefined,
      )) as EntryBulletsResult;
      if (!mounted.current || abort.signal.aborted) return;
      show(
        {
          stage: "review",
          result,
          useTitle: false,
          bullets: result.bullets.map((bullet) => ({
            id: bullet.id,
            text: bullet.text,
            evidence: bullet.evidence,
            picked: false,
          })),
        },
        result.bullets.length
          ? `${result.bullets.length} bullets are ready to review. Tick the ones to add.`
          : "No bullets this time. Read the questions.",
      );
    } catch (error) {
      if (!mounted.current || abort.signal.aborted) return;
      failed(error, "write");
    }
  }

  async function fetchExamples(seniority: Seniority | "") {
    const abort = controller();
    show({ stage: "working", flow: "examples" }, "Asking the AI for examples.");
    try {
      const result = (await accountRequest(
        "/api/ai/starters",
        {
          method: "POST",
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
          body: JSON.stringify({
            requestId: crypto.randomUUID(),
            jobTitle: title,
            section: noun === "project" ? "projects" : "experience",
            ...(seniority ? { seniority } : {}),
          }),
        },
        services.owner ?? undefined,
      )) as StartersResult;
      if (!mounted.current || abort.signal.aborted) return;
      show(
        {
          stage: "examples",
          jobTitle: title,
          seniority,
          cached: result.cached,
          bullets: result.bullets.map((text) => ({
            id: crypto.randomUUID(),
            blanks: blankState(text),
            picked: false,
          })),
        },
        "Examples are ready. Fill in the blanks of the ones that are true for you.",
      );
    } catch (error) {
      if (!mounted.current || abort.signal.aborted) return;
      failed(error, "examples");
    }
  }

  function close(message = "") {
    generation.current?.abort();
    show(null, message);
  }

  function finish(count: number, withTitle = false) {
    show(
      {
        stage: "done",
        message: `Added ${count} bullet${count === 1 ? "" : "s"}${withTitle ? " and the title" : ""}. Undo removes ${count === 1 && !withTitle ? "it" : "them"}.`,
      },
      "Added. Undo removes the change.",
    );
    setNotes("");
    setDuties("");
  }

  const examplesPicked =
    session?.stage === "examples" ? session.bullets.filter((b) => b.picked) : [];
  const examplesReady =
    examplesPicked.length > 0 && examplesPicked.every((b) => blanksReady(b.blanks));

  return (
    <div className="entry-ai field-ai" data-entry-ai={entry.id}>
      <div className="entry-ai-buttons">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Write with AI: ${label}`}
          onClick={() => begin("write")}
        >
          <Sparkles size={16} aria-hidden /> Write with AI
        </button>
        {title && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => begin("examples")}
          >
            <Lightbulb size={16} aria-hidden /> Show examples for “{title}”
          </button>
        )}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      {session && (
        <div
          className="field-ai-card entry-ai-card"
          role="group"
          aria-label={`AI help for ${label}`}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || session.stage === "working") return;
            event.preventDefault();
            event.stopPropagation();
            close("Closed. Your CV was not changed.");
          }}
        >
          {session.stage === "blocked" && (
            <AiBlocked status={session.status} services={services} />
          )}
          {session.stage === "consent" && (
            <AiConsent
              services={services}
              primaryRef={setPrimary}
              sends={
                session.flow === "write"
                  ? `Write with AI sends your notes and this ${noun}'s title, organization and bullets.`
                  : `Show examples sends only the job title “${title}”.`
              }
              onAgreed={() => begin(session.flow, [], true)}
              onCancel={() => close()}
            />
          )}
          {session.stage === "notes" && (
            <form
              className="field-ai-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (notes.trim()) void writeBullets();
              }}
            >
              {session.prompts.length > 0 && (
                <div className="entry-ai-prompts">
                  <p className="field-ai-help">
                    Use these examples as prompts. Write what you actually did;
                    only your notes are used.
                  </p>
                  <ul>
                    {session.prompts.map((prompt) => (
                      <li key={prompt}>{prompt}</li>
                    ))}
                  </ul>
                </div>
              )}
              <label>
                What did you do in this role? Rough notes are fine.
                <textarea
                  ref={setPrimary}
                  rows={5}
                  maxLength={4000}
                  value={notes}
                  placeholder="e.g. handled customer tickets, trained 3 new staff, used Zendesk"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <details>
                <summary>Paste duties from the old job ad (optional)</summary>
                <label>
                  Duties from the job ad
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={duties}
                    onChange={(event) => setDuties(event.target.value)}
                  />
                </label>
              </details>
              <p className="field-ai-help">
                Sends these notes and this {noun}&apos;s title, organization and
                bullets to OpenAI. Contact details are removed and not sent.
                Missing numbers become questions; nothing is made up.
              </p>
              <div className="field-ai-actions">
                <button type="submit" className="primary" disabled={!notes.trim()}>
                  Write bullets
                </button>
                <button type="button" onClick={() => close()}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {session.stage === "working" && (
            <div className="field-ai-form">
              <p role="status">
                Asking the AI. This can take up to a minute. Nothing changes
                until you accept.
              </p>
              <p className="field-ai-help">
                {session.flow === "write"
                  ? "Sends your notes and this entry. Contact details are not sent."
                  : `Sends only the job title “${title}”.`}
              </p>
              <div className="field-ai-actions">
                <button type="button" onClick={() => close("Cancelled. Your CV was not changed.")}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {session.stage === "review" && (
            <div className="field-ai-form entry-ai-review">
              {session.result.message && (
                <p className="field-ai-help">{session.result.message}</p>
              )}
              {session.result.title && !title && (
                <label className="field-ai-check">
                  <input
                    type="checkbox"
                    checked={session.useTitle}
                    onChange={(event) =>
                      setSession({ ...session, useTitle: event.target.checked })
                    }
                  />
                  Use the title from your notes: {session.result.title}
                </label>
              )}
              {session.bullets.length > 0 && (
                <fieldset>
                  <legend>Tick the bullets to add. You can edit them first.</legend>
                  <ul className="entry-ai-list">
                    {session.bullets.map((bullet, index) => (
                      <li key={bullet.id}>
                        <label className="field-ai-check">
                          <input
                            type="checkbox"
                            ref={index === 0 ? setPrimary : undefined}
                            checked={bullet.picked}
                            onChange={(event) =>
                              setSession({
                                ...session,
                                bullets: session.bullets.map((item) =>
                                  item.id === bullet.id
                                    ? { ...item, picked: event.target.checked }
                                    : item,
                                ),
                              })
                            }
                          />
                          Add suggestion {index + 1}
                        </label>
                        <textarea
                          aria-label={`Suggestion ${index + 1}`}
                          rows={2}
                          maxLength={400}
                          value={bullet.text}
                          onChange={(event) =>
                            setSession({
                              ...session,
                              bullets: session.bullets.map((item) =>
                                item.id === bullet.id
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <p className="entry-ai-source">
                          From your notes: {bullet.evidence.map((e) => `“${e}”`).join(" ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}
              {session.result.withheld.length > 0 && (
                <div className="entry-ai-withheld">
                  <p>
                    <strong>
                      {session.result.withheld.length} suggestion
                      {session.result.withheld.length === 1 ? " was" : "s were"} withheld
                    </strong>
                  </p>
                  <ul>
                    {session.result.withheld.map((item, index) => (
                      <li key={index}>{item.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {session.result.questions.length > 0 && (
                <div className="entry-ai-questions">
                  <p>
                    <strong>Questions to make it stronger</strong> (add the
                    answers to your notes and try again):
                  </p>
                  <ul>
                    {session.result.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="field-ai-help">
                The checks can make mistakes. Only add what is true.
              </p>
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  ref={session.bullets.length ? undefined : setPrimary}
                  disabled={
                    !session.useTitle &&
                    !session.bullets.some((b) => b.picked && b.text.trim())
                  }
                  onClick={() => {
                    const picked = session.bullets
                      .filter((b) => b.picked && b.text.trim())
                      .map((b) => b.text.trim());
                    const newTitle = session.useTitle ? session.result.title : undefined;
                    onAdd(picked, newTitle);
                    finish(picked.length, Boolean(newTitle));
                  }}
                >
                  <Check size={16} aria-hidden /> Add ticked
                </button>
                <button type="button" onClick={() => show({ stage: "notes", prompts: [] })}>
                  Change notes
                </button>
                <button type="button" onClick={() => close("Kept your entry. Nothing changed.")}>
                  <X size={16} aria-hidden /> Keep mine
                </button>
              </div>
            </div>
          )}
          {session.stage === "examples" && (
            <div className="field-ai-form starter-review">
              <p className="starter-label">Examples — make them yours</p>
              <div className="starter-intro">
                <p className="field-ai-help">
                  Examples for “{session.jobTitle}”, not facts about you. Type
                  your own details into the blanks of the ones that are true,
                  or remove a blank you do not need.
                </p>
                <label className="starter-level">
                  Level
                  <select
                    value={session.seniority}
                    onChange={(event) =>
                      void fetchExamples(event.target.value as Seniority | "")
                    }
                  >
                    <option value="">Any level</option>
                    {STARTER_SENIORITY.map((level) => (
                      <option key={level} value={level}>
                        {SENIORITY_LABEL[level]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ul className="starter-list">
                {session.bullets.map((bullet, index) => (
                  <li key={bullet.id} className={bullet.picked ? "picked" : undefined}>
                    <label className="starter-pick">
                      <input
                        type="checkbox"
                        ref={index === 0 ? setPrimary : undefined}
                        checked={bullet.picked}
                        onChange={(event) =>
                          setSession({
                            ...session,
                            bullets: session.bullets.map((item) =>
                              item.id === bullet.id
                                ? { ...item, picked: event.target.checked }
                                : item,
                            ),
                          })
                        }
                      />
                      <span>Use example {index + 1}</span>
                    </label>
                    <BlankFiller
                      label={`Example ${index + 1}`}
                      state={bullet.blanks}
                      onChange={(blanks) =>
                        setSession({
                          ...session,
                          // Working on an example picks it.
                          bullets: session.bullets.map((item) =>
                            item.id === bullet.id ? { ...item, blanks, picked: true } : item,
                          ),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
              {examplesPicked.length > 0 && !examplesReady && (
                <p className="field-ai-help" role="status">
                  Fill or remove every blank in the examples you picked to add them.
                </p>
              )}
              <div className="field-ai-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={!examplesReady}
                  onClick={() => {
                    const picked = examplesPicked.map((b) => composeBlanks(b.blanks));
                    onAdd(picked);
                    finish(picked.length);
                  }}
                >
                  <Check size={16} aria-hidden /> Add {examplesPicked.length || ""} to this job
                </button>
                <button
                  type="button"
                  onClick={() =>
                    begin(
                      "write",
                      examplesPicked.length
                        ? examplesPicked.map((b) => b.blanks.template)
                        : session.bullets.slice(0, 3).map((b) => b.blanks.template),
                    )
                  }
                >
                  Tell us what you actually did
                </button>
                <button type="button" onClick={() => close("Closed. Your CV was not changed.")}>
                  <X size={16} aria-hidden /> Keep mine
                </button>
              </div>
            </div>
          )}
          {session.stage === "error" && (
            <div className="field-ai-note">
              <p className="field-ai-error" role="alert">
                {session.message}
              </p>
              <div className="field-ai-actions">
                {session.plans ? (
                  <button type="button" className="primary" onClick={services.onSeePlans}>
                    See plans
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      session.flow === "write" ? void writeBullets() : void fetchExamples("")
                    }
                  >
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}
          {session.stage === "done" && (
            <p className="field-ai-note">
              <Check size={16} aria-hidden /> {session.message}
            </p>
          )}
          {["done", "error", "blocked"].includes(session.stage) && (
            <button type="button" className="field-ai-dismiss" onClick={() => close()}>
              Close
            </button>
          )}
        </div>
      )}
    </div>
  );
}
